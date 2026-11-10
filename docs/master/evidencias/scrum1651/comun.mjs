// Sonda de QA contra yaqu.app (cuenta QA). NO escribe en producciÃ³n: toda peticiÃ³n que no sea
// GET se corta o se contesta desde aquÃ­, y se demuestra con control positivo antes de pulsar.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire('C:/Users/Admin/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/');
const { chromium } = require('playwright-core');

export const BASE = 'https://yaqu.app';

export async function abrir({ respuestas = () => null, servir = {}, acepta = () => false, viewport = { width: 1280, height: 900 } } = {}) {
  const linea = readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim();
  const [nombre, ...resto] = linea.split('=');
  const browser = await chromium.launch({ executablePath: 'C:/Users/Admin/AppData/Local/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-win64/chrome-headless-shell.exe' });
  const context = await browser.newContext({ serviceWorkers: 'block', viewport });
  await context.addCookies([{ name: nombre, value: resto.join('='), domain: 'yaqu.app', path: '/', httpOnly: true, secure: true }]);
  const page = await context.newPage();
  const noGet = [];   // toda peticiÃ³n que no es GET, con lo que se hizo con ella
  const dialogos = [];
  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'GET') {
      // Sirve un fichero local en lugar del de producciÃ³n (y lo dice quien llama).
      const local = servir[url.pathname];
      if (local) return route.fulfill({ status: 200, contentType: (local.endsWith('.css') ? 'text/css' : 'application/javascript') + '; charset=utf-8', body: readFileSync(local, 'utf8') });
      return route.continue();
    }
    let cuerpo = null;
    try { cuerpo = req.postDataJSON(); } catch { cuerpo = req.postData(); }
    const r = respuestas(req.method(), url.pathname, cuerpo);
    noGet.push({ metodo: req.method(), ruta: url.pathname, cuerpo, hecho: r ? `contestada por la sonda (${r.status})` : 'cortada' });
    if (r) return route.fulfill({ status: r.status, contentType: 'application/json', body: JSON.stringify(r.body) });
    return route.abort();
  });
  page.on('dialog', async (d) => { dialogos.push({ tipo: d.type(), texto: d.message() }); if (acepta(d.message(), dialogos.length)) await d.accept(); else await d.dismiss(); });
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e.message)));
  await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle' });
  // 23-oct: con networkidle, renderAppView a veces aún no existe (primer intento de 1559j cayó así).
  await page.waitForFunction(() => typeof window.renderAppView === 'function', null, { timeout: 20000 });
  const build = await page.evaluate(() => document.querySelector('meta[name="yaqu-build"]')?.content || null);

  // CONTROL POSITIVO del interceptor, antes de pulsar nada: un POST de mentira NO debe salir.
  const control = await page.evaluate(async () => {
    try { const r = await fetch('/admin/__sonda_control_positivo', { method: 'POST', body: '{}' }); return 'SALIÃ“ ' + r.status; }
    catch (e) { return 'cortado'; }
  });
  if (control !== 'cortado') { await browser.close(); throw new Error('EL INTERCEPTOR NO CAZA: ' + control); }
  noGet.length = 0;
  return { browser, page, noGet, dialogos, errores, build };
}

export const resumen = (c) => (c && typeof c === 'object')
  ? Object.fromEntries(Object.entries(c).map(([k, v]) => [k, typeof v === 'string' && v.length > 60 ? `${v.slice(0, 40)}â€¦ (${v.length} car.)` : v]))
  : c;

