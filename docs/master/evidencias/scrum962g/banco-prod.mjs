// CUÑA de `scripts/_banco-lista.mjs` contra PRODUCCIÓN (S2, 23-oct-2026). Misma interfaz
// (servirListas / abrirNavegador / abrirVista) para que los guiones de 962c/962d corran SIN CAMBIAR
// su recorrido, pero la página es https://yaqu.app/dashboard/ REAL: su index.html, su CSS, su JS, sus
// fuentes, su app.js, con la cookie de la cuenta QA.
//
// Lo que es IGUAL que el banco, a propósito (para que la única variable sea banco ↔ producción):
//   · los MISMOS datos inyectados (`datos` de la ruta), en las rutas que esos datos nombran;
//   · `appModoEmision` declarado igual, si la ruta lo declara;
//   · la vista se monta con la MISMA función (`fnVista`) — vía el router real (`quotes-new`).
// Lo que es DISTINTO, y se declara: el resto de GET van a prod tal cual (/admin/me, flags…).
// NO ESCRIBE: toda petición que no sea GET se CORTA y se apunta. Control positivo al abrir.
import fs from 'node:fs';

// La cookie de la cuenta QA NO vive aquí (repo público): el FICHERO que la guarda, por entorno.
if (!process.env.YAQU_QA_SESION || !process.env.YAQU_CHROME) { console.error('🔴 NO SUPE MIRAR: faltan YAQU_QA_SESION (fichero con nombre=valor de la cookie de QA) y/o YAQU_CHROME (ejecutable)'); process.exit(2); }
const COOKIE = fs.readFileSync(process.env.YAQU_QA_SESION, 'utf8').trim();
const [CNOMBRE, ...CRESTO] = COOKIE.split('=');
const CHROME = process.env.YAQU_CHROME;
// Rutas cuyo dato pone el guion (las que nombran sus `DATOS`). El resto, a prod.
const INYECTADAS = [/\/admin\/customers/, /\/admin\/templates/, /frequent-concepts/, /\/admin\/products/];
const VISTA = { renderQuotesView: 'quotes-new' };

let RUTAS = [];
export const cortadas = [];
export async function servirListas(_publico, rutas) { RUTAS = rutas; return { srv: { close() {} }, puerto: 0 }; }
export async function abrirNavegador(puppeteer) {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  return { browser, quien: 'chrome-headless-shell (prod)' };
}
export async function abrirVista(browser, _puerto, ruta, ancho, alto = 900) {
  const r = RUTAS.find((x) => x.ruta === ruta);
  const datos = eval(r.datos);   // la misma función que el banco evalúa en la página
  const page = await browser.newPage();
  await page.setViewport({ width: ancho, height: alto });
  await page.setCookie({ name: CNOMBRE, value: CRESTO.join('='), domain: 'yaqu.app', path: '/', httpOnly: true, secure: true });
  // Sin service worker: lo que se mide es lo que sirve el origen ahora, no una copia en caché.
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (req.method() !== 'GET') { cortadas.push(req.method() + ' ' + u.pathname); return req.abort(); }
    // CONTROL: SERVIR_CSS=<fichero> sustituye el styles.css de prod (y lo dice la línea [prod]).
    // CONTROL: SIN_FUENTES=1 corta /fonts/* (la hipótesis: el banco no carga inter.css).
    if (process.env.SIN_FUENTES && u.hostname === 'yaqu.app' && u.pathname.startsWith('/fonts/')) return req.abort();
    if (process.env.SERVIR_CSS && u.hostname === 'yaqu.app' && u.pathname === '/dashboard/css/styles.css') {
      return req.respond({ status: 200, contentType: 'text/css; charset=utf-8', body: fs.readFileSync(process.env.SERVIR_CSS, 'utf8') });
    }
    if (u.hostname === 'yaqu.app' && INYECTADAS.some((re) => re.test(u.pathname))) {
      return req.respond({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify(datos(u.pathname + u.search) ?? []) });
    }
    return req.continue();
  });
  await page.evaluateOnNewDocument(() => { window.__errores = []; window.addEventListener('error', (e) => window.__errores.push(String(e.message))); });
  await page.goto('https://yaqu.app/dashboard/', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => typeof window.renderAppView === 'function', { timeout: 20000 });
  const control = await page.evaluate(async () => { try { const x = await fetch('/admin/__sonda_control_positivo', { method: 'POST', body: '{}' }); return 'SALIÓ ' + x.status; } catch { return 'cortado'; } });
  if (control !== 'cortado') throw new Error('EL INTERCEPTOR NO CAZA: ' + control);
  cortadas.length = 0;
  const info = await page.evaluate((modo, decl) => {
    const real = window.appModoEmision;
    if (decl) window.appModoEmision = modo;
    return { build: document.querySelector('meta[name="yaqu-build"]')?.content, modoReal: real, merchant: window.appMerchantId ?? null };
  }, r.modoEmision ?? null, Object.prototype.hasOwnProperty.call(r, 'modoEmision'));
  await page.evaluate((v) => window.renderAppView(v), VISTA[r.fnVista]);
  // «pintada»: la red quieta y el editor montado (su primer paso).
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 20000 }).catch(() => {});
  await page.waitForSelector('#view-container .quote-paso, #view-container [class*="quote-"]', { timeout: 20000 });
  await new Promise((ok) => setTimeout(ok, 600));
  const fuente = await page.evaluate(() => [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family + ' ' + f.weight).join(', ') || 'ninguna web');
  console.log(`   [prod${process.env.SERVIR_CSS ? ' · CSS SERVIDO ' + process.env.SERVIR_CSS : ''}${process.env.SIN_FUENTES ? ' · SIN FUENTES' : ''} · fuentes cargadas: ${fuente}] build ${String(info.build).slice(0, 9)} · modo real ${JSON.stringify(info.modoReal)}${Object.prototype.hasOwnProperty.call(r, 'modoEmision') ? ' → declarado ' + JSON.stringify(r.modoEmision) : ''} · @${ancho}`);
  return { page, errores: await page.evaluate('window.__errores') };
}
