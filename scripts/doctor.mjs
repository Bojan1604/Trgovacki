/**
 * Provjera okoline prije prvog pokretanja.
 *
 *   npm run doctor
 *
 * Traži uzroke koji najčešće zaustave postavljanje — verzija Node-a, nedostajući
 * `.env`, neispravna lozinka u `DATABASE_URL`, ugašen PostgreSQL, negenerirani
 * Prisma klijent — i za svaki ispisuje što konkretno napraviti.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import process from 'node:process';

const ok = (text, detail = '') => console.log(`  \x1b[32m✓\x1b[0m ${text}${detail ? ` — ${detail}` : ''}`);
const bad = (text, detail = '') => console.log(`  \x1b[31m✗\x1b[0m ${text}${detail ? ` — ${detail}` : ''}`);
const hint = (text) => console.log(`      \x1b[2m→ ${text}\x1b[0m`);

let problems = 0;
/** Naredba koju sažetak predlaže kad nema grešaka — baza možda još nije napunjena. */
let nextStep = 'npm run dev';
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

/**
 * Traži instalacije PostgreSQL-a na uobičajenim mjestima.
 *
 * Windows instalacija ne dodaje `bin` u PATH, pa `psql` u Command Promptu nije
 * prepoznat iako je poslužitelj uredno instaliran i pokrenut. Razlika između
 * "nije instaliran" i "instaliran, ali ne radi" mijenja sljedeći korak.
 *
 * Vraćamo sve pronađene verzije, a ne samo prvu: kad ih je više, svaka ima
 * vlastiti port i vlastitu lozinku korisnika postgres, pa je to čest uzrok
 * odbijene prijave.
 */
function findInstallations() {
  const roots =
    process.platform === 'win32'
      ? ['C:\\Program Files\\PostgreSQL', 'C:\\Program Files (x86)\\PostgreSQL']
      : ['/usr/lib/postgresql', '/usr/local/pgsql', '/opt/homebrew/opt'];

  const found = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root).sort().reverse()) {
      const bin = path.join(root, entry, 'bin');
      if (existsSync(bin)) found.push({ version: entry, bin });
    }
  }
  return found;
}

/**
 * Portovi na kojima instalacijski program ostavi PostgreSQL. Druga i svaka
 * sljedeća verzija na istom računalu dobiva 5433, 5434… jer je 5432 zauzet.
 */
const COMMON_PORTS = [5432, 5433, 5434, 5435];

/** Konfigurirani port i ostali portovi na kojima ipak nešto sluša. */
let configuredPort = 5432;
let otherPorts = [];

if (url) {
  const host = url.hostname;
  configuredPort = Number(url.port || 5432);

  if (await portOpen(host, configuredPort)) {
    ok('PostgreSQL sluša', `${host}:${configuredPort}`);
  } else {
    const installs = findInstallations();
    if (installs.length > 0) {
      fail('PostgreSQL je instaliran, ali ne prima veze', `${host}:${configuredPort}`,
        `Pronađene verzije: ${installs.map((i) => i.version).join(', ')} (${installs[0].bin})`,
        process.platform === 'win32'
          ? 'Pokrenite servis: otvorite services.msc, nađite "postgresql-x64-…" i kliknite Start'
          : 'Pokrenite servis PostgreSQL-a.',
        'Napomena: aplikaciji psql ne treba — spaja se preko mreže.');
    } else {
      fail('PostgreSQL nije pronađen', `${host}:${configuredPort}`,
        'Instalirajte ga: https://www.postgresql.org/download/windows/',
        'Ili podignite bazu Dockerom: docker compose up -d');
    }
  }

  // Zauzet port ne znači da je to poslužitelj koji tražimo. Popis ostalih
  // otvorenih portova koristi se niže kad prijava padne na lozinci.
  const candidates = COMMON_PORTS.filter((candidate) => candidate !== configuredPort);
  const open = await Promise.all(candidates.map((candidate) => portOpen(host, candidate, 1200)));
  otherPorts = candidates.filter((_, index) => open[index]);

  if (otherPorts.length > 0) {
    console.log(`  \x1b[33m•\x1b[0m Još jedan poslužitelj sluša — ${host}:${otherPorts.join(', ')}`);
    hint('Više instalacija PostgreSQL-a: svaka ima vlastiti port i vlastitu lozinku.');
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
      nextStep = 'npm run db:push';
    } else {
      ok('Tablice postoje', `${count} tablica`);
      const stores = await db.store.count().catch(() => 0);
      if (stores === 0) {
        hint('Nema podataka — pokrenite: npm run db:seed');
        nextStep = 'npm run db:seed';
      }
      else ok('Demo podaci su učitani', `${stores} poslovnica`);
    }
  } catch (error) {
    const message = String(error?.message ?? error);
    // Prisma poruke počinju praznim retkom i nastavljaju se ispisom upita, pa
    // uzimamo prvi redak koji uopće nešto kaže — inače se prikaže prazan opis.
    const code = String(error?.code ?? '');
    const firstLine =
      message
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.length > 0 && !line.startsWith('Invalid `')) ?? 'bez opisa';

    if (code === 'P1000' || message.includes('P1000') || message.toLowerCase().includes('authentication')) {
      // Kad sluša i drugi port, najčešći uzrok nije kriva lozinka nego kriv
      // poslužitelj: lozinka je postavljena na drugoj verziji PostgreSQL-a.
      const wrongServerHints =
        otherPorts.length > 0
          ? [`Na portu ${otherPorts.join(' i ')} sluša još jedan poslužitelj — vjerojatno druga verzija.`,
             `Ako ste lozinku postavljali na njoj, u .env zamijenite port ${configuredPort} s ${otherPorts[0]}.`,
             'Port poslužitelja piše u psql-u pri spajanju (redak "Port").']
          : [];

      fail('Lozinka nije prihvaćena', 'P1000',
        ...wrongServerHints,
        ...passwordNotes.flat(),
        'Provjerite lozinku kroz "SQL Shell (psql)" iz izbornika Start.',
        'Ako i ondje ne prolazi, lozinka u .env nije ona koju PostgreSQL očekuje.');
    } else if (code === 'P1001' || message.includes('P1001')) {
      fail('Poslužitelj baze nije dostupan', 'P1001', 'Provjerite radi li PostgreSQL servis.');
    } else if (
      code === 'P1003' ||
      message.includes('P1003') ||
      /does not exist|ne postoji/i.test(message) && /database|baz/i.test(message)
    ) {
      console.log('  \x1b[33m•\x1b[0m Baza još ne postoji');
      hint(`Pokrenite: npm run db:push — kreirat će bazu "${url.pathname.slice(1)}".`);
      hint('Zatim: npm run db:seed — napunit će je demo podacima.');
      nextStep = 'npm run db:push';
    } else {
      fail('Spajanje na bazu nije uspjelo', code || undefined, firstLine.slice(0, 120),
        'Ako poruka spominje da baza ne postoji, pokrenite: npm run db:push');
    }
  } finally {
    await db.$disconnect().catch(() => {});
  }
}

/* --- Sažetak ------------------------------------------------------------ */
console.log('');
if (problems === 0) {
  const heading = nextStep === 'npm run dev' ? 'Sve je spremno.' : 'Okolina je ispravna.';
  console.log(`\x1b[32m${heading}\x1b[0m Pokrenite: ${nextStep}\n`);
} else {
  console.log(`\x1b[31mPronađeno problema: ${problems}.\x1b[0m Riješite ih redom pa ponovite: npm run doctor\n`);
  process.exitCode = 1;
}
