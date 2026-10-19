// SCRUM-1206c · ver en yaqu.app que la ficha del PRESUPUESTO enseña su cabecera y sus Observaciones.
// Sólo GET: cualquier otra petición se ABORTA y se apunta. Cuenta QA (cookie de sesion-panel), SW bloqueado.
// ANTES: se sirve EN EL NAVEGADOR el `quotesDetailView.js` del padre del merge de #2537 (ruta 2).
// DESPUÉS: el de producción tal cual (ruta 3 omitida).
// Uso: node ver1206c-presupuesto.mjs <carpeta de salida> [quotesDetailView.js del ANTES]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire('C:/Users/Admin/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/');
const { chromium } = require('playwright-core');
const [OUT, JS_ANTES] = process.argv.slice(2);
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim().replace(/^pf_session=/, '').split(';')[0];
const antes = JS_ANTES ? fs.readFileSync(JS_ANTES, 'utf8') : null;
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

async function ficha(browser, id, ancho) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, serviceWorkers: 'block' });
  await ctx.addCookies([{ name: 'pf_session', value: cookie, domain: 'yaqu.app', path: '/', secure: true, httpOnly: true }]);
  const page = await ctx.newPage();
  const cuenta = { gets: 0, abortadas: [], jsAntesServido: false };
  let delGet = null;
  await page.route('**/*', async (route) => {
    const r = route.request();
    const p = new URL(r.url()).pathname;
    if (r.method() !== 'GET') { cuenta.abortadas.push(`${r.method()} ${p}`); return route.abort(); }
    cuenta.gets++;
    if (antes && p.endsWith('/quotesDetailView.js')) { cuenta.jsAntesServido = true; return route.fulfill({ status: 200, contentType: 'application/javascript', body: antes }); }
    if (p === `/admin/quotes/${id}`) {
      const resp = await route.fetch();
      delGet = await resp.json().catch(() => null);
      return route.fulfill({ response: resp });
    }
    return route.continue();
  });
  await page.goto(`https://yaqu.app/dashboard/#quotes-detail/${id}`, { waitUntil: 'networkidle' });
  await page.locator('.detail-section').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  // Las secciones del cuerpo, en el orden del DOM: su marca, su título y el arranque de su texto.
  const secciones = await page.$$eval('.detail-section', (ns) => ns.map((n) => ({
    seccion: n.dataset.seccion || null,
    titulo: (n.querySelector('.detail-section-title') || {}).textContent || null,
    texto: (n.querySelector('.quote-doc-texto') || {}).innerText || null,
    anchoTexto: n.querySelector('.quote-doc-texto') ? Math.round(n.querySelector('.quote-doc-texto').getBoundingClientRect().width) : null,
  })));
  const todo = await page.evaluate(() => document.body.innerText);
  const desborda = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  await page.screenshot({ path: `${OUT}/1206c-presupuesto-${id}-${antes ? 'antes' : 'despues'}-${ancho}.png`, fullPage: true });
  await ctx.close();
  const cab = secciones.find((s) => s.seccion === 'texto-cabecera');
  const obs = secciones.find((s) => s.seccion === 'observaciones');
  const i = (pred) => secciones.findIndex(pred);
  return {
    presupuesto: id, ancho, caso: antes ? 'ANTES' : 'DESPUES',
    orden: secciones.map((s) => s.seccion || s.titulo || '(sin título)'),
    cabecera: cab ? { titulo: cab.titulo, igualAlGet: norm(cab.texto) === norm(delGet?.docHeaderText), anchoTexto: cab.anchoTexto } : null,
    observaciones: obs ? { titulo: obs.titulo, igualAlGet: norm(obs.texto) === norm(delGet?.docFooterText), anchoTexto: obs.anchoTexto } : null,
    cabeceraAntesDeConceptos: cab ? i((s) => s.seccion === 'texto-cabecera') < i((s) => /concepto/i.test(s.titulo || '')) : null,
    rotuloDelFormularioVisible: todo.includes('Añadir texto en el documento'),
    desbordaEnHorizontal: desborda,
    delGet: delGet ? { status: delGet.status, docHeaderText: delGet.docHeaderText ?? null, docFooterText: delGet.docFooterText ?? null } : 'SIN GET (ciego)',
    ...cuenta,
  };
}

const browser = await chromium.launch();
try {
  for (const id of [202, 205, 206]) for (const ancho of [390, 1280]) {
    try { console.log(JSON.stringify(await ficha(browser, id, ancho))); }
    catch (e) { console.log(JSON.stringify({ presupuesto: id, ancho, CIEGO: String(e && e.message).slice(0, 300) })); }
  }
} finally { await browser.close(); }
