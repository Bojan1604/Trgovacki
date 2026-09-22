/**
 * Izrada PDF priručnika iz HTML predloška.
 *
 *   node scripts/build-manual.mjs
 *
 * Postupak:
 *   1. Dodatak s rezultatima automatske provjere generira se iz
 *      `docs/e2e-results.json` — brojke u priručniku nisu prepisane rukom.
 *   2. Sadržaj se slaže iz naslova u dokumentu.
 *   3. PDF se renderira dvaput: prvi prolaz služi za očitavanje stranice na
 *      kojoj svako poglavlje počinje, drugi ispisuje te brojeve u sadržaju.
 */

import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFile, writeFile, unlink, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const SHOTS_SRC = 'docs/screenshots';
const SHOTS_OUT = 'docs/screenshots-web';
const SRC = 'docs/prirucnik/prirucnik.html';
const TMP = 'docs/prirucnik/.render.html';
const OUT = 'docs/Trgovacki-prirucnik.pdf';

/**
 * Priprema snimki za ugradnju: širina 1500 px i JPEG umjesto PNG-a.
 * Izvorne snimke su na dvostrukoj gustoći i zajedno teže preko 25 MB —
 * u dokumentu bi to bio nepotreban teret bez vidljive razlike na papiru.
 */
async function prepareScreenshots() {
  await mkdir(SHOTS_OUT, { recursive: true });
  const files = (await readdir(SHOTS_SRC)).filter((f) => f.endsWith('.png')).sort();
  const existing = new Set(await readdir(SHOTS_OUT).catch(() => []));

  let converted = 0;
  for (const file of files) {
    const target = file.replace('.png', '.jpg');
    if (existing.has(target)) continue;
    await sharp(path.join(SHOTS_SRC, file))
      .resize({ width: 1500, withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(path.join(SHOTS_OUT, target));
    converted += 1;
  }
  return { total: files.length, converted };
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/* -------------------------------------------------------------------------- */
/*  Dodatak A — rezultati provjere                                            */
/* -------------------------------------------------------------------------- */

function buildResultsAppendix(data) {
  const bySection = new Map();
  for (const item of data.provjere) {
    if (!bySection.has(item.section)) bySection.set(item.section, []);
    bySection.get(item.section).push(item);
  }

  const datum = new Date(data.pokrenuto).toLocaleString('hr-HR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const summary = `
    <div class="note ${data.proslo === data.ukupno ? 'tip' : 'warn'}">
      <span class="label">Rezultat</span>
      <p>
        <b>${data.proslo} od ${data.ukupno}</b> provjera je prošlo u
        ${bySection.size} područja. Greške u konzoli preglednika:
        <b>${data.greskeUKonzoli.length === 0 ? 'nijedna' : data.greskeUKonzoli.length}</b>.
        Prolaz je izvršen ${escapeHtml(datum)}.
      </p>
    </div>`;

  const rows = [...bySection.entries()]
    .map(([section, items]) => {
      const head = `<tr><td colspan="3" style="background:var(--surface-2);font-weight:600;font-size:8.6pt;text-transform:uppercase;letter-spacing:0.04em;color:var(--ink-3)">${escapeHtml(section)}</td></tr>`;
      const body = items
        .map(
          (i) => `<tr>
            <td style="width:8mm"><span class="tag ${i.ok ? 'ok' : 'no'}">${i.ok ? '✓' : '✗'}</span></td>
            <td>${escapeHtml(i.name)}</td>
            <td style="color:var(--ink-3)">${escapeHtml(i.detail ?? '')}</td>
          </tr>`,
        )
        .join('');
      return head + body;
    })
    .join('');

  const table = `
    <table class="long">
      <thead><tr><th></th><th style="width:58%">Provjera</th><th>Izmjereno</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  return { summary, table };
}

/* -------------------------------------------------------------------------- */
/*  Sadržaj                                                                    */
/* -------------------------------------------------------------------------- */

/** Iz HTML-a izvlači poglavlja (h2) i numerirane pododjeljke (h3). */
function collectOutline(html) {
  const entries = [];
  const chapterRegex = /<section class="chapter" id="([^"]+)">\s*<h2>(?:<span class="kicker">([^<]*)<\/span>)?([^<]*)<\/h2>([\s\S]*?)<\/section>/g;

  for (const match of html.matchAll(chapterRegex)) {
    const [, id, kicker = '', title, body] = match;
    entries.push({ id, kicker: kicker.trim(), title: title.trim(), level: 1 });

    for (const sub of body.matchAll(/<h3>([^<]+)<\/h3>/g)) {
      const text = sub[1].trim();
      // U sadržaj idu samo numerirani pododjeljci (npr. "4.1 Otvaranje smjene").
      if (/^\d+\.\d+\s/.test(text)) entries.push({ title: text, level: 2, chapter: id });
    }
  }
  return entries;
}

function renderToc(entries, pages = {}) {
  return entries
    .map((entry) => {
      const page = pages[entry.id ?? entry.title];
      const pageCell = page ? `<span class="page">${page}</span>` : '<span class="page">—</span>';
      if (entry.level === 1) {
        return `<li><span class="num">${escapeHtml(entry.kicker.replace('Poglavlje ', '').replace('Dodatak ', ''))}</span><span class="title">${escapeHtml(entry.title)}</span><span class="dots"></span>${pageCell}</li>`;
      }
      const [num, ...rest] = entry.title.split(' ');
      return `<li class="sub"><span class="num">${escapeHtml(num)}</span><span class="title">${escapeHtml(rest.join(' '))}</span><span class="dots"></span>${pageCell}</li>`;
    })
    .join('\n');
}

/* -------------------------------------------------------------------------- */
/*  Renderiranje                                                               */
/* -------------------------------------------------------------------------- */

const footerTemplate = `
  <div style="width:100%;padding:0 16mm;font-family:Inter,-apple-system,sans-serif;font-size:7.5pt;color:#9a9da5;display:flex;justify-content:space-between;">
    <span>Trgovački — priručnik za korisnike</span>
    <span class="pageNumber"></span>
  </div>`;

async function render(page, htmlPath, outPath) {
  await page.goto(pathToFileURL(path.resolve(htmlPath)).href, { waitUntil: 'networkidle' });
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate,
    outline: true,
    tagged: true,
  });
}

/**
 * Očitava stranicu na kojoj počinje svako poglavlje i pododjeljak.
 *
 * Dvije zamke koje ovaj postupak izbjegava:
 *  - znakovi s dijakriticima dolaze kao zasebni tekstualni elementi
 *    ("Sadr ž aj"), pa se usporedba radi nad tekstom bez razmaka;
 *  - naslovi se pojavljuju i u sadržaju, koji je na početku dokumenta, pa bi
 *    naivno traženje svima dodijelilo stranicu sadržaja. Stranice sadržaja se
 *    zato preskaču — one su sve prije prvog poglavlja.
 */
async function measurePages(pdfPath, outline) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await readFile(pdfPath));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;

  const normalize = (value) => value.replace(/\s+/g, '').toUpperCase();
  const texts = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    texts[n] = normalize(content.items.map((i) => i.str).join(''));
  }
  const total = doc.numPages;
  await doc.cleanup?.();

  const pages = {};

  // 1. Poglavlja — oznaka tipa "POGLAVLJE 4" pojavljuje se samo na naslovnoj
  //    stranici poglavlja jer sadržaj ispisuje samo broj.
  for (const entry of outline.filter((e) => e.level === 1)) {
    const needle = normalize(`${entry.kicker}${entry.title}`);
    for (let n = 1; n <= total; n++) {
      if (texts[n].includes(needle)) {
        pages[entry.id] = n;
        break;
      }
    }
  }

  // 2. Sadržaj završava neposredno prije prvog poglavlja.
  const firstChapter = Math.min(...Object.values(pages).filter(Boolean));
  const afterToc = Number.isFinite(firstChapter) ? firstChapter : 1;

  // 3. Pododjeljci — traže se tek od stranice svojeg poglavlja nadalje.
  for (const entry of outline.filter((e) => e.level === 2)) {
    const from = Math.max(pages[entry.chapter] ?? afterToc, afterToc);
    const needle = normalize(entry.title);
    for (let n = from; n <= total; n++) {
      if (texts[n].includes(needle)) {
        pages[entry.title] = n;
        break;
      }
    }
  }

  return { pages, total };
}

/* -------------------------------------------------------------------------- */

const shots = await prepareScreenshots();
console.log(`Snimke: ${shots.total} (novo pripremljeno: ${shots.converted})`);

const source = await readFile(SRC, 'utf8');
const results = JSON.parse(await readFile('docs/e2e-results.json', 'utf8'));
const appendix = buildResultsAppendix(results);

let html = source
  .replace('<div id="provjera-sazetak"></div>', appendix.summary)
  .replace('<div id="provjera-tablica"></div>', appendix.table);

const outline = collectOutline(html);
html = html.replace('<ol id="toc-list"></ol>', `<ol id="toc-list">\n${renderToc(outline)}\n</ol>`);
await writeFile(TMP, html);

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const page = await browser.newPage();

// Prvi prolaz — samo da se izmjere stranice.
await render(page, TMP, OUT);

const { pages, total } = await measurePages(OUT, outline);

// Drugi prolaz — sa stvarnim brojevima stranica u sadržaju.
html = html.replace(
  /<ol id="toc-list">[\s\S]*?<\/ol>/,
  `<ol id="toc-list">\n${renderToc(outline, pages)}\n</ol>`,
);
await writeFile(TMP, html);
await render(page, TMP, OUT);

await browser.close();
await unlink(TMP);

const missing = outline.filter((e) => !pages[e.id ?? e.title]);
console.log(`Priručnik: ${OUT}`);
console.log(`Stranica: ${total} · unosa u sadržaju: ${outline.length}`);
if (missing.length) console.log('Bez broja stranice:', missing.map((m) => m.title).join(', '));
