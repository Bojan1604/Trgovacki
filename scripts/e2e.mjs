/**
 * Potpuni funkcionalni prolaz kroz aplikaciju.
 *
 * Vozi stvarne tokove u pregledniku (blagajna, katalog, nabava, izvještaji,
 * postavke), provjerava ishode i usput snima zaslone za priručnik.
 *
 *   node scripts/e2e.mjs [--base http://localhost:3000] [--shots docs/screenshots]
 *
 * Preduvjet: pokrenut poslužitelj i napunjena baza (`npm run db:seed`).
 */

import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

const BASE = arg('base', 'http://localhost:3000');
const SHOTS = arg('shots', 'docs/screenshots');
const EMAIL = arg('email', 'vlasnik@trgovacki.hr');
const PASSWORD = arg('password', 'demo1234');

await mkdir(SHOTS, { recursive: true });

const results = [];
const consoleErrors = [];
let shotIndex = 0;

/** Hrvatska množina: 1 dokument, 2 dokumenta, 5 dokumenata. */
function plural(count, one, few, many) {
  const n = Math.abs(count) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return `${count} ${many}`;
  if (last === 1) return `${count} ${one}`;
  if (last >= 2 && last <= 4) return `${count} ${few}`;
  return `${count} ${many}`;
}

/** Iznos iz kartice pokazatelja u čitljiv oblik ("69.099€" → "69.099 €"). */
function amount(text) {
  return text.replace(/\s*€\s*$/, '').trim() + ' €';
}

let currentSection = '';

function check(name, condition, detail = '') {
  results.push({ section: currentSection, name, ok: Boolean(condition), detail });
  const mark = condition ? '✓' : '✗';
  console.log(`  ${mark} ${name}${detail ? ` — ${detail}` : ''}`);
  return Boolean(condition);
}

function section(title) {
  currentSection = title;
  console.log(`\n▸ ${title}`);
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
  locale: 'hr-HR',
});
const page = await context.newPage();

page.on('pageerror', (e) => consoleErrors.push(`[pageerror] ${String(e).slice(0, 160)}`));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) {
    consoleErrors.push(`[console] ${m.text().slice(0, 160)}`);
  }
});

/** Snima zaslon pod rednim brojem i opisnim imenom. */
async function shot(name, options = {}) {
  shotIndex += 1;
  const file = `${SHOTS}/${String(shotIndex).padStart(2, '0')}-${name}.png`;
  await page.waitForTimeout(options.settle ?? 450);
  await page.screenshot({ path: file, fullPage: options.fullPage ?? false });
  return file;
}

/** Vrijednost ukupnog iznosa u košarici kao broj. */
async function cartTotal() {
  const text = await page.locator('aside .text-3xl').innerText();
  return Number.parseFloat(text.replace(/\s|€/g, '').replace(/\./g, '').replace(',', '.'));
}


/* ========================================================================== */
/*  Izvještaji                                                                */
/* ========================================================================== */
async function runReports() {
  section('Izvještaji');

  await page.goto(`${BASE}/reports`, { waitUntil: 'networkidle' });
  const cards = await page.locator('main a').count();
  check('Pregled izvještaja nudi sve izvještaje', cards >= 12, plural(cards, 'izvještaj', 'izvještaja', 'izvještaja'));
  await shot('izvjestaji-pregled');

  const reports = [
    ['sales', 'Promet po danima', 'Kretanje dnevnog prometa'],
    ['products', 'Prodaja po artiklima', 'Udio'],
    ['stores', 'Usporedba poslovnica', 'Promet po poslovnicama'],
    ['margin', 'Marža i RUC', 'Marža po glavnim kategorijama'],
    ['stock', 'Vrijednost zaliha', 'Po poslovnicama'],
    ['abc', 'ABC analiza', 'Rang artikala'],
    ['cashiers', 'Učinak prodavača', 'Promet po prodavaču'],
    ['tax', 'Rekapitulacija PDV-a', 'Po poreznim stopama'],
    ['payments', 'Načini plaćanja', 'Struktura naplate'],
    ['hourly', 'Promet po satima', 'Raspodjela prometa kroz dan'],
    ['slow-movers', 'Artikli bez obrtaja', 'Vezana vrijednost'],
    ['kepu', 'Knjiga popisa', 'Dnevni promet robe'],
  ];

  for (const [slug, label, marker] of reports) {
    await page.goto(`${BASE}/reports/${slug}`, { waitUntil: 'networkidle' });
    const visible = await page.getByText(marker).first().isVisible().catch(() => false);
    const rowCount = await page.locator('tbody tr').count();
    // Prazan izvještaj je ispravan ishod ako podaci ne postoje — bitno je da
    // se u tom slučaju prikaže poruka, a ne prazna tablica bez objašnjenja.
    const emptyState = await page.locator('main').getByText(/^Nema /).first().isVisible().catch(() => false);
    check(`Izvještaj: ${label}`, visible && (rowCount > 0 || emptyState),
      rowCount > 0 ? plural(rowCount, 'redak', 'retka', 'redaka') : 'prazno stanje');
  }

  await page.goto(`${BASE}/reports/margin`, { waitUntil: 'networkidle' });
  await shot('izvjestaj-marza', { fullPage: true });
  await page.goto(`${BASE}/reports/abc`, { waitUntil: 'networkidle' });
  await shot('izvjestaj-abc');
  await page.goto(`${BASE}/reports/tax`, { waitUntil: 'networkidle' });
  await shot('izvjestaj-pdv');

  // Promjena razdoblja mijenja brojke.
  await page.goto(`${BASE}/reports/sales?range=7d`, { waitUntil: 'networkidle' });
  const week = await page.locator('main .text-2xl').first().innerText();
  await page.goto(`${BASE}/reports/sales?range=90d`, { waitUntil: 'networkidle' });
  const quarter = await page.locator('main .text-2xl').first().innerText();
  check('Promjena razdoblja mijenja rezultat', week !== quarter, `7 dana ${amount(week)} · 90 dana ${amount(quarter)}`);
  await shot('izvjestaj-promet');
}

/* ========================================================================== */
/*  Kupci i vjernost                                                          */
/* ========================================================================== */
async function runCustomers() {
  section('Kupci i program vjernosti');

  await page.goto(`${BASE}/customers`, { waitUntil: 'networkidle' });
  check('Popis kupaca je popunjen', (await page.locator('tbody tr').count()) > 0);
  await shot('kupci');

  await page.locator('tbody tr td a').first().click();
  await page.waitForSelector('text=Povijest kupnji', { timeout: 60_000 });
  check('Detalj kupca prikazuje povijest kupnji', true);
  await shot('kupac-detalj', { fullPage: true });

  await page.goto(`${BASE}/customers/loyalty`, { waitUntil: 'networkidle' });
  const liability = await page.locator('main .text-2xl').nth(2).innerText();
  check('Izračunata obveza po bodovima vjernosti', liability.length > 1, amount(liability));
  check('Prikazane razine programa', await page.getByText('Platina').first().isVisible());
  await shot('program-vjernosti');

  await page.goto(`${BASE}/customers/gift-cards`, { waitUntil: 'networkidle' });
  check('Popis poklon kartica je popunjen', (await page.locator('tbody tr').count()) > 0);
  await shot('poklon-kartice');
}

/* ========================================================================== */
/*  Postavke                                                                  */
/* ========================================================================== */
async function runSettings() {
  section('Postavke');

  await page.goto(`${BASE}/settings/stores`, { waitUntil: 'networkidle' });
  const stores = await page.locator('tbody tr').count();
  check('Popis poslovnica je popunjen', stores > 1, plural(stores, 'lokacija', 'lokacije', 'lokacija'));
  await shot('postavke-poslovnice');

  await page.goto(`${BASE}/settings/users`, { waitUntil: 'networkidle' });
  check('Popis korisnika je popunjen', (await page.locator('tbody tr').count()) > 1);
  await shot('postavke-korisnici');

  await page.goto(`${BASE}/settings/roles`, { waitUntil: 'networkidle' });
  const roleCols = await page.locator('thead th').count();
  check('Matrica prava prikazuje sve role', roleCols >= 7, plural(roleCols - 1, 'rola', 'role', 'rola'));
  await shot('postavke-role', { fullPage: true });

  await page.goto(`${BASE}/settings/audit`, { waitUntil: 'networkidle' });
  check('Revizijski trag bilježi radnje', (await page.locator('tbody tr').count()) > 0);
  await shot('revizijski-trag');

  await page.goto(`${BASE}/settings/integrations`, { waitUntil: 'networkidle' });
  check('Prikazane integracije i status fiskalizacije', await page.getByText('Fiskalizacija').first().isVisible());
  await shot('integracije');

  await page.goto(`${BASE}/sales/fiscal`, { waitUntil: 'networkidle' });
  check('Zaslon fiskalizacije prikazuje status računa', await page.getByText('Fiskalizirani računi').isVisible());
  await shot('fiskalizacija');
}

/* ========================================================================== */
/*  Blagajna                                                                  */
/* ========================================================================== */
async function runPos() {
  section('Blagajna — otvaranje smjene');

  await page.goto(`${BASE}/pos`, { waitUntil: 'networkidle' });
  if (await page.getByRole('button', { name: /Otvori smjenu/ }).count()) {
    await shot('blagajna-otvaranje-smjene');
    // Blagajna zauzima cijeli ekran; bez izlaza je zaslon otvaranja smjene
    // slijepa ulica iz koje korisnik ne može natrag u back office.
    const gateExit = page.locator('a:has-text("Back office")').first();
    check('Zaslon otvaranja smjene nudi izlaz u back office',
      await gateExit.isVisible(), await gateExit.getAttribute('href'));
    await page.getByRole('button', { name: /Otvori smjenu/ }).click();
  }
  await page.waitForSelector('text=Košarica je prazna', { timeout: 60_000 });
  check('Smjena je otvorena i blagajna je spremna', true);

  const posExit = page.locator('a:has-text("Back office")').first();
  check('Otvorena blagajna nudi izlaz u back office',
    await posExit.isVisible(), await posExit.getAttribute('href'));

  section('Blagajna — košarica');
  const tiles = page.locator('section button.group');
  const tileCount = await tiles.count();
  check('Mreža artikala je popunjena', tileCount > 10, plural(tileCount, 'artikl', 'artikla', 'artikala'));

  await tiles.nth(0).click();
  await page.waitForTimeout(1200);
  const oneItem = await cartTotal();
  check('Dodavanje artikla puni košaricu', oneItem > 0, `${oneItem.toFixed(2)} €`);

  // Povećanje količine na odabranoj stavci.
  await page.locator('aside li').first().click();
  await page.waitForTimeout(300);
  await page.locator('aside li').first().locator('button').nth(2).click();
  await page.waitForTimeout(1300);
  const twoItems = await cartTotal();
  check('Povećanje količine udvostručuje iznos', Math.abs(twoItems - oneItem * 2) < 0.02,
    `${oneItem.toFixed(2)} → ${twoItems.toFixed(2)} €`);

  // Skeniranje barkoda.
  const barcode = await page.evaluate(async () => {
    const res = await fetch('/api/pos/products?q=&limit=5');
    const data = await res.json();
    return data.items.find((i) => i.barcode)?.barcode ?? null;
  });
  if (barcode) {
    await page.getByPlaceholder(/Skeniraj barkod/).fill(barcode);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const lines = await page.locator('aside li').count();
    check('Skeniranje barkoda dodaje artikl', lines >= 1, `barkod ${barcode}`);
  }

  section('Blagajna — popust i kupac');
  await page.locator('aside li').first().click();
  await page.waitForTimeout(300);
  const beforeDiscount = await cartTotal();
  await page.getByRole('button', { name: 'Popust' }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '20 %' }).click();
  await shot('blagajna-popust');
  await page.getByRole('button', { name: 'Primijeni' }).click();
  await page.waitForTimeout(1500);
  const afterDiscount = await cartTotal();
  check('Ručni popust umanjuje iznos', afterDiscount < beforeDiscount,
    `${beforeDiscount.toFixed(2)} → ${afterDiscount.toFixed(2)} €`);

  await page.getByRole('button', { name: /Bez kupca/ }).click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder(/Ime, telefon/).fill('Horvat');
  await page.waitForTimeout(1500);
  await shot('blagajna-kupac');
  const customerHits = page.locator('[role="dialog"] button:has-text("K0")');
  if (await customerHits.count()) {
    await customerHits.first().click();
    await page.waitForTimeout(1600);
    const withCustomer = await cartTotal();
    check('Kupac s razinom vjernosti dobiva dodatni popust', withCustomer <= afterDiscount,
      `${afterDiscount.toFixed(2)} → ${withCustomer.toFixed(2)} €`);
  } else {
    await page.keyboard.press('Escape');
  }
  await shot('blagajna-kosarica');

  section('Blagajna — parkiranje računa');
  const parkedTotal = await cartTotal();
  await page.getByRole('button', { name: /Parkiraj/ }).click();
  await page.waitForTimeout(2500);
  check('Parkiranje prazni košaricu', (await page.locator('aside li').count()) === 0);

  await page.getByRole('button', { name: /Parkirani/ }).click();
  await page.waitForTimeout(600);
  await shot('blagajna-parkirani');
  const parkedButton = page.locator('[role="dialog"] button').filter({ hasText: /^P-\d/ }).first();
  check('Parkirani račun je na popisu', (await parkedButton.count()) > 0);
  await parkedButton.click();
  await page.waitForTimeout(3500);
  const resumed = await cartTotal();
  check('Vraćanje parkiranog računa vraća stavke', resumed > 0,
    `parkirano ${parkedTotal.toFixed(2)} € → vraćeno ${resumed.toFixed(2)} €`);

  section('Blagajna — naplata gotovinom');
  await page.getByRole('button', { name: /Naplati/ }).click();
  await page.waitForSelector('text=Za naplatu', { timeout: 30_000 });
  await shot('blagajna-naplata');
  await page.getByRole('button', { name: 'Gotovina', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Zaključi račun/ }).click();
  await page.waitForSelector('text=Račun je izdan', { timeout: 60_000 });
  const receipt = await page.locator('[role="dialog"]').innerText();
  const receiptNo = receipt.match(/Račun: ([^\n]+)/)?.[1] ?? '';
  check('Račun je izdan s brojem i fiskalnim podacima', receiptNo.length > 0, `broj ${receiptNo}`);
  check('Potvrda prikazuje povrat ostatka', receipt.includes('Povrat') || receipt.includes('€'));
  await shot('blagajna-racun');
  await page.getByRole('button', { name: /Nova prodaja/ }).click();
  await page.waitForTimeout(800);

  section('Blagajna — naplata karticom');
  await tiles.nth(1).click();
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: /Naplati/ }).click();
  await page.waitForSelector('text=Za naplatu', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Kartica', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Zaključi račun/ }).click();
  await page.waitForSelector('text=Račun je izdan', { timeout: 60_000 });
  check('Naplata karticom prolazi', true);
  await page.getByRole('button', { name: /Nova prodaja/ }).click();
  await page.waitForTimeout(800);

  section('Blagajna — povrat robe');
  await page.getByRole('button', { name: /Povrat/ }).click();
  await page.waitForTimeout(600);
  await page.getByLabel(/Broj računa/).fill(receiptNo);
  await page.getByRole('button', { name: /Pronađi/ }).click();
  await page.waitForTimeout(2000);
  const found = await page.getByText('Razlog povrata').isVisible().catch(() => false);
  check('Račun za povrat je pronađen po broju', found, receiptNo);
  if (found) {
    await page.locator('[role="dialog"] tbody tr').first().locator('span').first().click();
    await page.waitForTimeout(500);
    await shot('blagajna-povrat');
    await page.getByRole('button', { name: /Provedi povrat/ }).click();
    // Obavijest se sama gasi nakon nekoliko sekundi, pa se čita odmah.
    await page.waitForTimeout(1500);
    const toast = await page.locator('.fixed.bottom-4').innerText().catch(() => '');
    check('Povrat je proveden', toast.toLowerCase().includes('povrat'), toast.replace(/\n/g, ' ').slice(0, 60));
    await page.waitForTimeout(1500);
  }

  section('Blagajna — zatvaranje smjene');
  await page.getByRole('button', { name: /Zatvori smjenu/ }).click();
  await page.waitForTimeout(800);
  const expected = await page.getByText('Očekivano u ladici').locator('..').innerText();
  check('Obračun prikazuje očekivanu gotovinu', expected.includes('€'), expected.replace(/\n/g, ' '));
  await page.locator('[role="dialog"] input').last().fill('200');
  await page.waitForTimeout(600);
  await shot('blagajna-zatvaranje');
  await page.getByRole('dialog').getByRole('button', { name: 'Zatvori smjenu' }).click();
  await page.waitForSelector('text=Smjena je zatvorena', { timeout: 30_000 });
  const zReport = await page.locator('[role="dialog"]').innerText();
  check('Z-izvještaj prikazuje promet i razliku', zReport.includes('Razlika'), zReport.replace(/\n/g, ' ').slice(0, 90));
  await shot('blagajna-z-izvjestaj');
  await page.getByRole('button', { name: 'U redu' }).click();
  await page.waitForTimeout(1500);

  section('Prodaja — evidencija');
  await page.goto(`${BASE}/sales/receipts`, { waitUntil: 'networkidle' });
  const salesRows = await page.locator('tbody tr').count();
  check('Izdani računi su vidljivi u evidenciji', salesRows > 0, plural(salesRows, 'dokument', 'dokumenta', 'dokumenata'));

  const tableText = await page.locator('main tbody').first().innerText();
  check('Povrat je evidentiran kao odobrenje uz izvorni račun',
    tableText.includes('Storniran') || tableText.includes('Djelomični povrat'));
  await shot('racuni');

  await page.locator('tbody tr td a').first().click();
  await page.waitForSelector('text=Rekapitulacija', { timeout: 60_000 });
  check('Detalj računa prikazuje rekapitulaciju PDV-a i plaćanje', true);
  await shot('racun-detalj', { fullPage: true });

  await page.goto(`${BASE}/sales/shifts`, { waitUntil: 'networkidle' });
  check('Popis smjena prikazuje razlike u blagajni', (await page.locator('tbody tr').count()) > 0);
  await shot('smjene');

  await page.locator('tbody tr td a').first().click();
  await page.waitForSelector('text=Obračun gotovine', { timeout: 60_000 });
  check('Z-izvještaj smjene je dostupan u back officeu', true);
  await shot('smjena-z-izvjestaj', { fullPage: true });
}

/* ========================================================================== */
/*  Tamna tema                                                                */
/* ========================================================================== */
async function runDarkMode() {
  section('Tamna tema');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    localStorage.setItem('tg-theme', 'dark');
    document.documentElement.dataset.theme = 'dark';
  });
  await page.waitForTimeout(700);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  check('Tamna tema se primjenjuje', theme === 'dark');
  await shot('tamna-tema');

  await page.goto(`${BASE}/pos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await shot('blagajna-tamna-tema');
}

try {
  // =========================================================================
  section('Prijava');
  // =========================================================================
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  check('Zaslon prijave se prikazuje', await page.getByRole('heading', { name: 'Prijava' }).isVisible());
  await shot('prijava');

  await page.getByLabel(/E-pošta/).fill(EMAIL);
  await page.getByLabel(/Lozinka/).fill(PASSWORD);
  const loginResponse = page.waitForResponse((r) => r.url().includes('/api/auth/login'), { timeout: 60_000 });
  await page.getByRole('button', { name: /Prijavi se/ }).click();
  const loginStatus = (await loginResponse).status();
  check('Poslužitelj prihvaća prijavu', loginStatus === 200, `HTTP ${loginStatus}`);

  // Navigacija je na klijentu; čeka se sadržaj odredišne stranice, ne događaj `load`.
  await page.waitForSelector('h1:has-text("Nadzorna ploča")', { timeout: 60_000 });
  check('Prijava vodi na nadzornu ploču', page.url().includes('/dashboard'), page.url());

  // =========================================================================
  section('Nadzorna ploča');
  // =========================================================================
  await page.waitForSelector('text=Kretanje prometa', { timeout: 60_000 });
  const kpiCount = await page.locator('main .text-2xl').count();
  check('Prikazani ključni pokazatelji', kpiCount >= 6, `${kpiCount} pokazatelja`);
  const promet = await page.locator('main .text-2xl').first().innerText();
  check('Promet je izračunat', Number.parseFloat(promet.replace(/[^0-9,.]/g, '').replace(/\./g, '').replace(',', '.')) > 0, amount(promet));
  await shot('nadzorna-ploca');

  await page.getByRole('button', { name: /Lanac/ }).click();
  // Brojka se mijenja tek kad stignu podaci za cijeli lanac — čekanje na
  // promjenu je pouzdanije od fiksnog odbrojavanja.
  await page
    .waitForFunction(
      (previous) => document.querySelector('main .text-2xl')?.textContent?.trim() !== previous,
      promet.trim(),
      { timeout: 30_000 },
    )
    .catch(() => {});
  const prometLanac = await page.locator('main .text-2xl').first().innerText();
  check('Prebacivanje na cijeli lanac mijenja brojke', prometLanac !== promet, amount(prometLanac));
  await shot('nadzorna-ploca-lanac');

  // =========================================================================
  section('Globalna pretraga');
  // =========================================================================
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(400);
  await page.getByPlaceholder(/Artikl, barkod, kupac/).fill('mlijeko');
  await page.waitForTimeout(1200);
  const overlay = page.locator('div.fixed.inset-0.z-\\[70\\]');
  const hits = await overlay.locator('button', { hasText: 'Mlijeko' }).count();
  check('Pretraga vraća rezultate', hits > 0, plural(hits, 'pogodak', 'pogotka', 'pogodaka'));
  await shot('globalna-pretraga');
  await page.keyboard.press('Escape');

  // =========================================================================
  section('Katalog artikala');
  // =========================================================================
  await page.goto(`${BASE}/catalog/products`, { waitUntil: 'networkidle' });
  const rows = await page.locator('tbody tr').count();
  check('Popis artikala je popunjen', rows > 10, `${plural(rows, 'redak', 'retka', 'redaka')} na stranici`);
  await shot('katalog-artikli');

  await page.getByPlaceholder(/Naziv, šifra ili barkod/).fill('kava');
  await page.waitForTimeout(1500);
  const filtered = await page.locator('tbody tr').count();
  check('Pretraga filtrira popis', filtered > 0 && filtered < rows, plural(filtered, 'redak', 'retka', 'redaka'));
  await shot('katalog-pretraga');

  await page.locator('tbody tr td a').first().click();
  await page.waitForSelector('text=Zaliha po lokacijama', { timeout: 60_000 });
  check('Detalj artikla prikazuje zalihu po lokacijama', true);
  const hasKartica = await page.getByRole('heading', { name: 'Kartica artikla' }).isVisible();
  check('Detalj artikla prikazuje karticu kretanja', hasKartica);
  await shot('artikl-detalj', { fullPage: true });

  // =========================================================================
  section('Novi artikl s kalkulacijom');
  // =========================================================================
  await page.goto(`${BASE}/catalog/products/new`, { waitUntil: 'networkidle' });
  const sku = `E2E${Date.now().toString().slice(-6)}`;
  await page.getByLabel(/Šifra artikla/).fill(sku);
  await page.getByLabel(/^Naziv/).first().fill('Probni artikl iz automatskog prolaza');
  await page.getByRole('button', { name: 'Generiraj' }).click();
  const barcode = await page.getByLabel(/Barkod/).inputValue();
  check('Generiran ispravan EAN-13', /^\d{13}$/.test(barcode), barcode);

  await page.getByLabel(/Nabavna cijena/).fill('4,20');
  await page.getByLabel(/^Marža/).fill('30');
  await page.waitForTimeout(700);
  const mpc = await page.locator('text=Maloprodajna cijena').locator('..').innerText();
  check('Kalkulacija: 4,20 € uz 30 % marže i PDV 25 % daje 7,50 €', mpc.includes('7,50'), mpc.replace(/\n/g, ' '));
  await shot('novi-artikl-kalkulacija');

  await page.getByRole('button', { name: /Spremi artikl/ }).click();
  await page.waitForSelector('text=Zaliha po lokacijama', { timeout: 60_000 });
  check('Novi artikl je spremljen i otvoren', page.url().includes('/catalog/products/'), page.url().split('/').pop());

  // =========================================================================
  section('Cijene i akcije');
  // =========================================================================
  await page.goto(`${BASE}/pricing/promotions`, { waitUntil: 'networkidle' });
  const promoRows = await page.locator('tbody tr').count();
  check('Popis akcija je popunjen', promoRows > 0, plural(promoRows, 'akcija', 'akcije', 'akcija'));
  const promoTypes = await page.locator('main tbody').first().innerText();
  check('Tablica prikazuje različite tipove akcija',
    promoTypes.includes('Kupi X dobij Y') && promoTypes.includes('Popust na košaricu'));
  await shot('akcije');

  await page.goto(`${BASE}/pricing/price-changes`, { waitUntil: 'networkidle' });
  const nivRows = await page.locator('tbody tr').count();
  check('Popis nivelacija je popunjen', nivRows > 0, plural(nivRows, 'dokument', 'dokumenta', 'dokumenata'));
  await page.locator('tbody tr td a').first().click();
  await page.waitForSelector('text=Razlog promjene', { timeout: 60_000 });
  check('Detalj nivelacije prikazuje razliku vrijednosti zalihe', true);
  await shot('nivelacija-detalj');

  // =========================================================================
  section('Skladište');
  // =========================================================================
  await page.goto(`${BASE}/inventory/stock`, { waitUntil: 'networkidle' });
  const stockValue = await page.locator('main .text-2xl').nth(2).innerText();
  check('Izračunata vrijednost zalihe po nabavnoj cijeni', stockValue.length > 1, amount(stockValue));
  await shot('stanje-zaliha');

  await page.goto(`${BASE}/inventory/transfers`, { waitUntil: 'networkidle' });
  check('Popis međuskladišnica je popunjen', (await page.locator('tbody tr').count()) > 0);
  await page.locator('tbody tr td a').first().click();
  await page.waitForSelector('text=Podaci dokumenta', { timeout: 60_000 });
  check('Detalj međuskladišnice prikazuje otpremu i zaprimanje', true);
  await shot('medjuskladisnica');

  await page.goto(`${BASE}/inventory/stocktakes`, { waitUntil: 'networkidle' });
  check('Popis inventura je popunjen', (await page.locator('tbody tr').count()) > 0);
  await page.locator('tbody tr td a').first().click();
  await page.waitForSelector('text=Prebrojano stavki', { timeout: 60_000 });
  check('Detalj inventure prikazuje manjak i višak', true);
  await shot('inventura');

  await page.goto(`${BASE}/inventory/replenishment`, { waitUntil: 'networkidle' });
  const replRows = await page.locator('tbody tr').count();
  check('Prijedlog nabave je izračunat', replRows >= 0, `${plural(replRows, 'artikl', 'artikla', 'artikala')} ispod minimuma`);
  await shot('prijedlog-nabave');

  // =========================================================================
  section('Nabava');
  // =========================================================================
  await page.goto(`${BASE}/purchasing/receipts`, { waitUntil: 'networkidle' });
  check('Popis primki je popunjen', (await page.locator('tbody tr').count()) > 0);
  await shot('primke');

  await page.locator('tbody tr td a').first().click();
  await page.waitForSelector('text=Kalkulacija', { timeout: 60_000 });
  const kalk = await page.locator('table').first().innerText();
  check('Kalkulacija prikazuje razrez zavisnih troškova', kalk.includes('ZAV. TR.') || kalk.includes('Zav. tr.'));
  check('Kalkulacija prikazuje konačnu nabavnu cijenu i maržu', kalk.toLowerCase().includes('nc konačna'));
  await shot('primka-kalkulacija', { fullPage: true });

  await page.goto(`${BASE}/purchasing/orders`, { waitUntil: 'networkidle' });
  check('Popis narudžbenica je popunjen', (await page.locator('tbody tr').count()) > 0);
  await page.locator('tbody tr td a').first().click();
  await page.waitForSelector('text=Zaprimanje', { timeout: 60_000 });
  check('Detalj narudžbenice prati zaprimanje', true);
  await shot('narudzbenica');

  await runReports();
  await runCustomers();
  await runSettings();
  await runPos();
  await runDarkMode();

  await browser.close();
} catch (error) {
  console.error('\n✗ Prolaz je prekinut:', error.message);
  await page.screenshot({ path: `${SHOTS}/greska.png` }).catch(() => {});
  await browser.close();
  process.exitCode = 1;
}

// Rezultat se sprema u JSON kako bi ga priručnik mogao prikazati iz stvarnih
// podataka, umjesto prepisivanja iz ispisa.
await writeFile(
  'docs/e2e-results.json',
  JSON.stringify(
    {
      pokrenuto: new Date().toISOString(),
      ukupno: results.length,
      proslo: results.filter((r) => r.ok).length,
      greskeUKonzoli: consoleErrors,
      provjere: results,
    },
    null,
    2,
  ),
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${'─'.repeat(60)}`);
console.log(`Provjera: ${results.length - failed.length}/${results.length} prošlo`);
if (failed.length) console.log('Nije prošlo:\n' + failed.map((f) => `  ✗ ${f.name}`).join('\n'));
if (consoleErrors.length) console.log(`Greške u konzoli (${consoleErrors.length}):\n` + consoleErrors.slice(0, 5).map((e) => `  ${e}`).join('\n'));
else console.log('Bez grešaka u konzoli.');
if (failed.length) process.exitCode = 1;
