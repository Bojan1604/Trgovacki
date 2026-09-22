/**
 * Pomoćna skripta za snimanje zaslona aplikacije (razvoj i pregled dizajna).
 *
 *   node scripts/screenshot.mjs <url> <izlazna-datoteka> [light|dark] [širina] [visina]
 *
 * Kolačić sesije se prosljeđuje kroz varijablu okoline TG_COOKIES
 * (JSON polje kolačića u Playwright formatu).
 */
import { chromium } from 'playwright';

const [, , url, out, theme = 'light', width = '1680', height = '1000'] = process.argv;
if (!url || !out) {
  console.error('Upotreba: node scripts/screenshot.mjs <url> <izlaz.png> [light|dark] [širina] [visina]');
  process.exit(1);
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: Number(width), height: Number(height) },
  deviceScaleFactor: 2,
});
if (process.env.TG_COOKIES) await context.addCookies(JSON.parse(process.env.TG_COOKIES));

const page = await context.newPage();
await page.addInitScript((value) => {
  try {
    localStorage.setItem('tg-theme', value);
  } catch {
    /* privatni način rada */
  }
}, theme);
await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
await page.waitForTimeout(600);
await page.screenshot({ path: out });
await browser.close();
console.log('Snimljeno:', out);
