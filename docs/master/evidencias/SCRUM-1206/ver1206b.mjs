// SCRUM-1206b · ver en yaqu.app que la ficha del albarán enseña su cabecera y sus observaciones.
// Sólo GET: cualquier otra petición se ABORTA y se apunta. Cuenta QA (cookie de sesion-panel).
// El #46 lleva nota según su GET; el #47 es el control (la que tenga o no, se compara con su GET).
// Uso: node ver1206b.mjs <carpeta de salida>
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright-core');
const OUT = process.argv[2];
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim().replace(/^pf_session=/, '').split(';')[0];

async function ficha(browser, id, ancho) {
  // 🔴 serviceWorkers:'block' — con el SW de la casa, sus fetch no pasan por page.route (SCRUM-1233g).
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, serviceWorkers: 'block' });
  await ctx.addCookies([{ name: 'pf_session', value: cookie, domain: 'yaqu.app', path: '/', secure: true, httpOnly: true }]);
  const page = await ctx.newPage();
  const cuenta = { gets: 0, abortadas: [] };
  let delGet = null;
  await page.route('**/*', async (route) => {
    const r = route.request();
    if (r.method() === 'GET') {
      cuenta.gets++;
      if (new URL(r.url()).pathname === `/admin/albaranes/${id}`) {
        const resp = await route.fetch();
        delGet = await resp.json().catch(() => null);
        return route.fulfill({ response: resp });
      }
      return route.continue();
    }
    cuenta.abortadas.push(`${r.method()} ${new URL(r.url()).pathname}`);
    return route.abort();
  });
  await page.goto(`https://yaqu.app/dashboard/#albaran-detail/${id}`, { waitUntil: 'networkidle' });
  await page.locator('.detail-rail').first().waitFor({ timeout: 15000 });
  const filas = await page.$$eval('.detail-rail .detail-rail-linea--nota', (ns) => ns.map((n) => {
    const et = n.querySelector('.detail-rail-etiqueta');
    const val = [...n.querySelectorAll('span')].find((s) => !s.classList.contains('detail-rail-etiqueta'));
    return { etiqueta: et ? et.textContent : null, valor: val ? val.textContent : null, anchoValor: val ? Math.round(val.getBoundingClientRect().width) : null };
  }));
  const numero = await page.locator('.detail-head h2').first().textContent().catch(() => null);
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.screenshot({ path: `${OUT}/1206b-albaran-${id}-${ancho}.png`, fullPage: true });
  await ctx.close();
  return {
    albaran: id, ancho, numero, filas, desbordaEnHorizontal: desborda,
    delGet: delGet ? { docHeaderText: delGet.docHeaderText ?? null, notas: delGet.notas ?? null } : 'SIN GET (ciego)',
    ...cuenta,
  };
}

const browser = await chromium.launch();
try {
  for (const id of [46, 47, 48]) for (const ancho of [390, 1280]) {
    try { console.log(JSON.stringify(await ficha(browser, id, ancho))); }
    catch (e) { console.log(JSON.stringify({ albaran: id, ancho, CIEGO: String(e && e.message).slice(0, 300) })); }
  }
} finally { await browser.close(); }
