// SCRUM-817 · capturas a 390 y 1280 con `page.setViewport` REAL, del detalle del Trabajo.
//
// Se monta la pantalla en un navegador de verdad cargando los MISMOS scripts que declara
// `public/dashboard/index.html`, en su orden, y sirviendo `/admin/*` desde un servidor local con
// datos de muestra. No hay sesión ni base: lo que se captura es el PINTADO, que es lo que cambia.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../scripts/_navegador.mjs';
import { scriptsDelDashboard, hojasDelDashboard } from '../tests/_banco-vistas.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ETIQUETA = process.argv[2] || 'x';
const DESTINO = path.join(RAIZ, '.medida');
fs.mkdirSync(DESTINO, { recursive: true });

const JOB = {
  id: 7, status: 'in_progress', createdAt: '2026-09-01T09:00:00Z', titulo: 'Revisión anual',
  customer: { id: 3, name: 'IES Ramón y Cajal' },
  asignados: [{ id: 1, name: 'Javier P.' }], operario: null,
  albaranes: [], gastos: [], invoices: [], notes: 'Llamar al conserje antes de subir.',
  quote: { currency: 'EUR' }, direccion: 'C/ Mayor 1, Madrid',
  totalAceptado: 480, totalCobrado: 0,
};

const scripts = scriptsDelDashboard(RAIZ);           // rutas relativas, EN ORDEN
const hojas = hojasDelDashboard(RAIZ);               // las hojas locales del índice

const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (u.startsWith('/admin/team')) return json(res, [{ id: 1, name: 'Javier P.' }, { id: 2, name: 'Javier Pereira' }]);
  if (u.startsWith('/admin/merchant')) return json(res, { name: 'Epipe' });
  if (u.startsWith('/admin/partes')) return json(res, { partes: [] });
  if (/gastos/.test(u)) return json(res, { gastos: [] });
  if (u.startsWith('/admin/')) return json(res, JOB);
  // estáticos del dashboard y las hojas
  const cand = u === '/' ? null : path.join(RAIZ, 'public', u.replace(/^\//, ''));
  if (cand && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
    const tipo = cand.endsWith('.css') ? 'text/css' : 'application/javascript';
    res.writeHead(200, { 'content-type': `${tipo}; charset=utf-8` });
    return res.end(fs.readFileSync(cand));
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta charset="utf-8"><title>detalle</title>
${hojas.map((h) => `<link rel="stylesheet" href="/${path.relative(path.join(RAIZ, 'public'), h).replace(/\\/g, '/')}">`).join('\n')}
<body><div class="app-main"><div id="view"></div></div>
${scripts.map((s) => `<script src="/dashboard/${s}"></script>`).join('\n')}
<script>
  window.appUserRole = 'admin';
  window.appUserName = 'Epipe';
  window.renderAppView = function () {};
</script></body>`);
});
function json(res, o) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); }

await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;

const nav = await lanzarNavegador(puppeteer, { headless: 'new' });
for (const ancho of [390, 1280]) {
  const pag = await nav.newPage();
  await pag.setViewport({ width: ancho, height: ancho === 390 ? 844 : 900, deviceScaleFactor: 2 });
  await pag.goto(BASE, { waitUntil: 'networkidle0' });
  const ok = await pag.evaluate(async () => {
    const c = document.getElementById('view');
    if (typeof window.renderJobDetailView !== 'function') return 'sin renderJobDetailView';
    try { await window.renderJobDetailView(c, { jobId: 7 }); } catch (e) { return 'error: ' + e.message; }
    await new Promise((r) => setTimeout(r, 600));
    return 'ok:' + c.querySelectorAll('*').length;
  });
  const f = path.join(DESTINO, `${ETIQUETA}-${ancho}.png`);
  await pag.screenshot({ path: f, fullPage: true });
  console.log(`  ${ancho}px → ${ok} → ${path.basename(f)} (${(fs.statSync(f).size / 1024).toFixed(0)} KB)`);
  await pag.close();
}
await nav.close();
srv.close();
