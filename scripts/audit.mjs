/**
 * Statička revizija sučelja.
 *
 *   npm run audit
 *
 * Traži dvije stvari koje se u pregledu lako previde, a korisnik ih odmah
 * osjeti: gumb koji ne radi ništa i vezu koja ne vodi ni na jednu rutu.
 * Izlazi s greškom ako nađe vezu bez rute — to je uvijek kvar; mrtvi gumbi
 * se samo popisuju, jer dio njih čeka funkcionalnost koja tek dolazi.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(p)) files.push(p);
  }
})('src');

/**
 * Atributi JSX elementa od pozicije `<Tag`.
 * Brojimo vitičaste i uglate zagrade da `icon={<Plus />}` ne prekine element.
 */
function readAttrs(text, start) {
  let i = start;
  let brace = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    if (quote) {
      if (c === quote && text[i - 1] !== '\\') quote = null;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
    } else if (c === '{') brace++;
    else if (c === '}') brace--;
    else if (c === '>' && brace === 0) {
      return { attrs: text.slice(start, i), end: i, selfClosing: text[i - 1] === '/' };
    }
    i++;
  }
  return null;
}

// Definicija IconButtona prosljeđuje onClick kroz {...props}, pa nije mrtva.
const IGNORE = ['src/components/ui/button.tsx'];

const deadButtons = [];
for (const file of files) {
  if (IGNORE.includes(file.replace(/\\/g, '/'))) continue;
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/<(Button|IconButton)\b/g)) {
    const parsed = readAttrs(text, m.index + m[0].length);
    if (!parsed) continue;
    const { attrs } = parsed;
    if (/onClick|onSubmit|type=["']submit["']|href=|asChild|formAction/.test(attrs)) continue;

    // Gumb u <Link> je ispravan — veza nosi radnju.
    const before = text.slice(Math.max(0, m.index - 600), m.index);
    const lastLinkOpen = before.lastIndexOf('<Link');
    const lastLinkClose = before.lastIndexOf('</Link>');
    if (lastLinkOpen > lastLinkClose && lastLinkOpen !== -1) continue;

    const line = text.slice(0, m.index).split('\n').length;
    const label = text.slice(m.index, parsed.end + 160).replace(/\s+/g, ' ')
      .replace(/<(Button|IconButton)[^>]*?>/, '').replace(/<\/(Button|IconButton)>[\s\S]*$/, '').trim()
      || attrs.match(/label=["']([^"']+)/)?.[1] || '(bez natpisa)';
    deadButtons.push({ file, line, label: label.slice(0, 60) });
  }
}

/* --- Interne veze koje ne odgovaraju nijednoj ruti ---------------------- */
const routeDirs = [];
(function walkRoutes(dir) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) walkRoutes(p);
    else if (entry === 'page.tsx') routeDirs.push(dir);
  }
})('src/app');

const routes = routeDirs
  .map((d) => d.replace(/^src[\\/]app/, '').replace(/[\\/]\([^)]+\)/g, '').replace(/\\/g, '/') || '/');
const dynamicRoutes = routes.filter((r) => r.includes('['));
const staticRoutes = new Set(routes.filter((r) => !r.includes('[')));

function routeExists(href) {
  const p = href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  if (staticRoutes.has(p)) return true;
  return dynamicRoutes.some((r) => new RegExp('^' + r.replace(/\[[^\]]+\]/g, '[^/]+') + '$').test(p));
}

const badLinks = [];
for (const file of files.concat(['src/components/layout/nav-config.ts'])) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/href[=:]\s*["'`](\/[^"'`${]*)["'`]/g)) {
    if (m[1].startsWith('/api/')) continue;
    if (!routeExists(m[1])) badLinks.push({ file, line: text.slice(0, m.index).split('\n').length, href: m[1] });
  }
}

console.log(`Ruta: ${routes.length} (${dynamicRoutes.length} dinamičkih)\n`);
console.log(`── Gumbi bez radnje: ${deadButtons.length}`);
for (const b of deadButtons) console.log(`   ${b.file.replace('src/app/(app)/','').replace('src/components/','~/')}:${b.line}  ${b.label}`);
console.log(`\n── Veze bez rute: ${badLinks.length}`);
for (const l of badLinks) console.log(`   ${l.file}:${l.line}  ${l.href}`);

if (badLinks.length > 0) process.exitCode = 1;
