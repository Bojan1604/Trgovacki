import { chromium } from 'playwright';

const [,, url, out, theme = 'light', w = '1600', h = '1000'] = process.argv;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 2 });
await ctx.addCookies(JSON.parse(process.env.TG_COOKIES));
const page = await ctx.newPage();
await page.addInitScript((t) => { try { localStorage.setItem('tg-theme', t); } catch {} }, theme);
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(700);
await page.screenshot({ path: out, fullPage: false });
await browser.close();
console.log('ok', out);
