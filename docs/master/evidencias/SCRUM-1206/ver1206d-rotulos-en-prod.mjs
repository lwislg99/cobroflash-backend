// Medir los rótulos del rail: albarán #48 y Trabajo #76 (cuenta QA). Sólo GET; el resto se aborta.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright-core');
const OUT = process.argv[2];
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim().replace(/^pf_session=/, '').split(';')[0];

async function medir(browser, hash, ancho) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, serviceWorkers: 'block' });
  await ctx.addCookies([{ name: 'pf_session', value: cookie, domain: 'yaqu.app', path: '/', secure: true, httpOnly: true }]);
  const page = await ctx.newPage();
  const cuenta = { gets: 0, abortadas: [] };
  await page.route('**/*', (route) => {
    const r = route.request();
    if (r.method() === 'GET') { cuenta.gets++; return route.continue(); }
    cuenta.abortadas.push(`${r.method()} ${new URL(r.url()).pathname}`);
    return route.abort();
  });
  await page.goto(`https://yaqu.app/dashboard/#${hash}`, { waitUntil: 'networkidle' });
  await page.locator('.detail-rail').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const rotulos = await page.$$eval('.detail-rail .detail-total-label, .detail-rail .detail-rail-etiqueta, .detail-rail .detail-section-title', (ns) => ns.map((n) => {
    const cs = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    return {
      clase: n.className, texto: n.textContent, seVe: n.innerText,
      transform: cs.textTransform, size: cs.fontSize, weight: cs.fontWeight, color: cs.color, spacing: cs.letterSpacing,
      x: Math.round(r.x), y: Math.round(r.y),
    };
  }));
  const rail = await page.$eval('.detail-rail', (n) => { const r = n.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), padreClase: n.parentElement.className }; });
  await page.locator('.detail-rail').first().screenshot({ path: `${OUT}/rail-${hash.replace('/', '-')}-${ancho}.png` }).catch(() => {});
  await ctx.close();
  return { hash, ancho, rail, rotulos, ...cuenta };
}

const browser = await chromium.launch();
try {
  for (const hash of ['albaran-detail/48', 'albaran-detail/46', 'jobs-detail/76']) for (const ancho of [390, 1280]) {
    try { console.log(JSON.stringify(await medir(browser, hash, ancho))); }
    catch (e) { console.log(JSON.stringify({ hash, ancho, CIEGO: String(e && e.message).slice(0, 300) })); }
  }
} finally { await browser.close(); }
