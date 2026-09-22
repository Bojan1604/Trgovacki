/**
 * Provjera okoline prije prvog pokretanja.
 *
 *   npm run doctor
 *
 * Traži uzroke koji najčešće zaustave postavljanje — verzija Node-a, nedostajući
 * `.env`, neispravna lozinka u `DATABASE_URL`, ugašen PostgreSQL, negenerirani
 * Prisma klijent — i za svaki ispisuje što konkretno napraviti.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import process from 'node:process';

const ok = (text, detail = '') => console.log(`  \x1b[32m✓\x1b[0m ${text}${detail ? ` — ${detail}` : ''}`);
const bad = (text, detail = '') => console.log(`  \x1b[31m✗\x1b[0m ${text}${detail ? ` — ${detail}` : ''}`);
const hint = (text) => console.log(`      \x1b[2m→ ${text}\x1b[0m`);

let problems = 0;
const fail = (text, detail, ...hints) => {
  problems += 1;
  bad(text, detail);
  hints.forEach(hint);
};

console.log('\nProvjera okoline\n');

/* --- Node --------------------------------------------------------------- */
const [major, minor] = process.versions.node.split('.').map(Number);
if (major > 20 || (major === 20 && minor >= 9)) ok('Node.js', `v${process.versions.node}`);
else fail('Node.js je prestar', `v${process.versions.node}`, 'Potrebna je verzija 20.9 ili novija: https://nodejs.org');

/* --- .env --------------------------------------------------------------- */
if (!existsSync('.env')) {
  fail('Nedostaje datoteka .env', '', 'Windows: copy .env.example .env', 'macOS/Linux: cp .env.example .env');
} else {
  ok('Datoteka .env postoji');
}

const env = existsSync('.env') ? readFileSync('.env', 'utf8') : '';
const readVar = (name) => env.match(new RegExp(`^${name}\\s*=\\s*"?([^"\\r\\n]*)"?`, 'm'))?.[1] ?? '';

/* --- AUTH_SECRET -------------------------------------------------------- */
const secret = readVar('AUTH_SECRET');
if (secret.length >= 32) ok('AUTH_SECRET je postavljen', `${secret.length} znakova`);
else fail('AUTH_SECRET je prekratak', `${secret.length} znakova`, 'Mora imati barem 32 znaka.');

/* --- DATABASE_URL ------------------------------------------------------- */
const raw = readVar('DATABASE_URL');
/** Zapažanja o lozinci; prikazuju se tek ako prijava na bazu ne prođe. */
const passwordNotes = [];
let url = null;

if (!raw) {
  fail('DATABASE_URL nije postavljen', '', 'Primjer: postgresql://postgres:LOZINKA@localhost:5432/trgovacki?schema=public');
} else {
  try {
    url = new URL(raw);
    const password = decodeURIComponent(url.password ?? '');
    ok('DATABASE_URL je ispravnog oblika', `${url.hostname}:${url.port || 5432}${url.pathname}`);

    // O lozinci ne presuđujemo ovdje — neke instalacije je ne traže.
    // Zapažanja se prijavljuju tek ako stvarno spajanje padne na ovjeri.
    if (!password) {
      passwordNotes.push(['Lozinka nije upisana u DATABASE_URL',
        'Upišite lozinku koju ste postavili pri instalaciji PostgreSQL-a.']);
    } else if (/^(postgres|lozinka|password|vasa_lozinka)$/i.test(password)) {
      passwordNotes.push([`Lozinka je ostala kao primjer ("${password}")`,
        'Zamijenite je stvarnom lozinkom korisnika postgres.']);
    }

    // Posebni znakovi u lozinci moraju biti postotno kodirani jer je ovo URL.
    const rawPassword = raw.slice(raw.indexOf(':', raw.indexOf('//')) + 1, raw.lastIndexOf('@'));
    const risky = [...new Set([...rawPassword].filter((c) => '@:/?#[]&= '.includes(c)))];
    if (risky.length > 0) {
      passwordNotes.push([`Lozinka sadrži znakove koje u URL-u treba kodirati: ${risky.join(' ')}`,
        '@ → %40, : → %3A, / → %2F, # → %23, ? → %3F, & → %26, razmak → %20']);
    }
  } catch {
    fail('DATABASE_URL nije ispravan URL', raw.slice(0, 40),
      'Oblik: postgresql://korisnik:lozinka@host:port/baza?schema=public');
  }
}

/* --- Dostupnost poslužitelja -------------------------------------------- */
async function portOpen(host, port, timeout = 2500) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeout);
    socket.on('connect', () => done(true));
    socket.on('timeout', () => done(false));
    socket.on('error', () => done(false));
  });
}

if (url) {
  const host = url.hostname;
  const port = Number(url.port || 5432);
  if (await portOpen(host, port)) {
    ok('PostgreSQL sluša', `${host}:${port}`);
  } else {
    fail('PostgreSQL nije dostupan', `${host}:${port}`,
      'Windows: otvorite services.msc i pokrenite servis "postgresql-x64-…"',
      'Docker: docker compose up -d');
  }
}

/* --- Prisma klijent ----------------------------------------------------- */
let clientReady = false;
try {
  const { PrismaClient } = await import('@prisma/client');
  new PrismaClient();
  clientReady = true;
  ok('Prisma klijent je generiran');
} catch {
  fail('Prisma klijent nije generiran', '', 'Pokrenite: npm run db:generate');
}

/* --- Stvarna prijava na bazu -------------------------------------------- */
if (clientReady && url) {
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient();
  try {
    await db.$queryRaw`SELECT 1`;
    ok('Prijava na bazu uspjela');

    const tables = await db.$queryRaw`
      SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'
    `;
    const count = tables[0]?.count ?? 0;
    if (count === 0) {
      console.log('  \x1b[33m•\x1b[0m Baza je prazna');
      hint('Pokrenite: npm run db:push  pa  npm run db:seed');
    } else {
      ok('Tablice postoje', `${count} tablica`);
      const stores = await db.store.count().catch(() => 0);
      if (stores === 0) hint('Nema podataka — pokrenite: npm run db:seed');
      else ok('Demo podaci su učitani', `${stores} poslovnica`);
    }
  } catch (error) {
    const message = String(error?.message ?? error);
    if (message.includes('P1000') || message.toLowerCase().includes('authentication')) {
      fail('Lozinka nije prihvaćena', 'P1000',
        ...passwordNotes.flat(),
        'Provjerite lozinku izravno: psql -U postgres -h localhost -d postgres',
        'Ako i ondje ne prolazi, lozinka u .env nije ona koju PostgreSQL očekuje.');
    } else if (message.includes('P1001')) {
      fail('Poslužitelj baze nije dostupan', 'P1001', 'Provjerite radi li PostgreSQL servis.');
    } else if (message.includes('P1003')) {
      console.log('  \x1b[33m•\x1b[0m Baza još ne postoji');
      hint('Pokrenite: npm run db:push — kreirat će je.');
    } else {
      fail('Spajanje na bazu nije uspjelo', message.split('\n')[0].slice(0, 90));
    }
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

/* --- Sažetak ------------------------------------------------------------ */
console.log('');
if (problems === 0) {
  console.log('\x1b[32mSve je spremno.\x1b[0m Pokrenite: npm run dev\n');
} else {
  console.log(`\x1b[31mPronađeno problema: ${problems}.\x1b[0m Riješite ih redom pa ponovite: npm run doctor\n`);
  process.exitCode = 1;
}
