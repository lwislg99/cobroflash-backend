// SCRUM-1206d · antes de empujar: yaqu.app con MI albaranDetailView.js (servido desde disco en el navegador)
// y el GET del #48 completado EN EL NAVEGADOR con presupuesto y una foto, para que salgan las 8 filas.
// Nada se escribe en el servidor: todo lo que no es GET se aborta. Uso: node rotulos-local.mjs <js|main> <out>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright-core');
const [JS, OUT] = process.argv.slice(2);
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim().replace(/^pf_session=/, '').split(';')[0];
const local = JS === 'main' ? null : fs.readFileSync(JS, 'utf8');

async function medir(browser, ancho) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, serviceWorkers: 'block' });
  await ctx.addCookies([{ name: 'pf_session', value: cookie, domain: 'yaqu.app', path: '/', secure: true, httpOnly: true }]);
  const page = await ctx.newPage();
  const cuenta = { gets: 0, abortadas: [], jsLocalServido: false };
  await page.route('**/*', async (route) => {
    const r = route.request();
    const p = new URL(r.url()).pathname;
    if (r.method() !== 'GET') { cuenta.abortadas.push(`${r.method()} ${p}`); return route.abort(); }
    cuenta.gets++;
    if (local && p.endsWith('/albaranDetailView.js')) { cuenta.jsLocalServido = true; return route.fulfill({ status: 200, contentType: 'application/javascript', body: local }); }
    if (p === '/admin/albaranes/48') {
      const resp = await route.fetch(); const d = await resp.json();
      d.quote = { id: 2, number: 2 }; d.pendientes = [{ pendiente: 1 }];
      return route.fulfill({ response: resp, json: d });
    }
    if (p === '/admin/albaranes/48/fotos') return route.fulfill({ status: 200, contentType: 'application/json', body: '[{"id":999999}]' });
    return route.continue();
  });
  await page.goto('https://yaqu.app/dashboard/#albaran-detail/48', { waitUntil: 'networkidle' });
  await page.locator('.detail-rail').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  const rotulos = await page.$$eval('.detail-rail .detail-total-label, .detail-rail .detail-rail-etiqueta', (ns) => ns.map((n) => {
    const cs = getComputedStyle(n); const r = n.getBoundingClientRect();
    const sig = n.nextElementSibling; const rs = sig && sig.getBoundingClientRect();
    return { clase: n.className, seVe: n.innerText, size: cs.fontSize, weight: cs.fontWeight, transform: cs.textTransform,
      valorDebajo: rs ? Math.round(rs.top) >= Math.round(r.bottom) - 1 : null, distancia: rs ? Math.round(rs.top - r.bottom) : null };
  }));
  const enlace = await page.$eval('.detail-rail a.detail-rail-enlace', (a) => { const r = a.getBoundingClientRect(); return { alto: Math.round(r.height), ancho: Math.round(r.width) }; }).catch(() => null);
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.locator('.detail-rail').first().screenshot({ path: `${OUT}/rail-48-${JS === 'main' ? 'antes' : 'despues'}-${ancho}.png` });
  await ctx.close();
  return { ancho, rotulos, enlace, desbordaEnHorizontal: desborda, ...cuenta };
}

const browser = await chromium.launch();
try { for (const ancho of [390, 1280]) console.log(JSON.stringify(await medir(browser, ancho))); }
finally { await browser.close(); }
