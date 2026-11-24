// SCRUM-1810b · capturas a 390 y 1280 de la ficha de un documento PAGADO, con el «⋯» abierto:
// una FACTURA (A: sin «Marcar como cobrada») y un JUSTIFICANTE (B: «Marcar como pendiente").
// Misma forma que `scripts/capturar-detalle-trabajo.mjs` (SCRUM-817): los scripts REALES del índice
// del panel, en su orden, y `/admin/*` servido en local con datos de EJEMPLO. Sin sesión ni base.
// Uso: node docs/master/evidencias/SCRUM-1810/capturar-1810b.mjs   → deja los PNG junto a este fichero.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';
import { scriptsDelDashboard, hojasDelDashboard } from '../../../../tests/_banco-vistas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');

const BASE_DOC = {
  id: 7, total: 133.1, currency: 'EUR', createdAt: '2026-11-02T09:00:00.000Z',
  status: 'paid', paidAt: '2026-11-20T10:00:00.000Z',
  customerName: 'Reformas Ejemplo', customerTaxId: 'B12345678',
  customerPhone: '+34600000000', customerEmail: 'cliente@ejemplo.test',
  customer: { id: 1, name: 'Reformas Ejemplo', phone: '+34600000000' },
  lines: [{ concept: 'Alicatado de baño', qty: 1, price: 110, tax: 0.21 }],
  rectifiedBy: [],
};
const CASOS = {
  factura: { ...BASE_DOC, type: 'F1', number: 'F-2026-0007' },
  justificante: { ...BASE_DOC, type: 'JUST', number: 'J-2026-0007' },
};
let actual = CASOS.factura;

const scripts = scriptsDelDashboard(RAIZ);
const hojas = hojasDelDashboard(RAIZ);
const srv = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  if (/^\/admin\/invoices\/7$/.test(u)) return json(res, actual);
  if (u.startsWith('/admin/merchant')) return json(res, { name: 'Epipe' });
  if (u.startsWith('/admin/')) return json(res, []);
  const cand = u === '/' ? null : path.join(RAIZ, 'public', u.replace(/^\//, ''));
  if (cand && fs.existsSync(cand) && fs.statSync(cand).isFile()) {
    const tipo = cand.endsWith('.css') ? 'text/css' : 'application/javascript';
    res.writeHead(200, { 'content-type': `${tipo}; charset=utf-8` });
    return res.end(fs.readFileSync(cand));
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(`<!doctype html><meta charset="utf-8"><title>ficha</title>
${hojas.map((h) => `<link rel="stylesheet" href="/${path.relative(path.join(RAIZ, 'public'), h).replace(/\\/g, '/')}">`).join('\n')}
<body><div class="app-main"><div id="view"></div></div>
${scripts.map((s) => `<script src="/dashboard/${s}"></script>`).join('\n')}
<script>
  window.appUserRole = 'admin';
  window.appUserName = 'Epipe';
  window.appModoEmision = 'fiscal';
  window.renderAppView = function () {};
</script></body>`);
});
function json(res, o) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); }

await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
const nav = await lanzarNavegador(puppeteer, { headless: 'new' });
for (const [nombre, doc] of Object.entries(CASOS)) {
  actual = doc;
  for (const ancho of [390, 1280]) {
    const pag = await nav.newPage();
    await pag.setViewport({ width: ancho, height: ancho === 390 ? 844 : 900, deviceScaleFactor: 2 });
    await pag.goto(BASE, { waitUntil: 'networkidle0' });
    const rotulos = await pag.evaluate(async () => {
      const c = document.getElementById('view');
      if (typeof window.renderInvoiceDetailView !== 'function') return 'sin renderInvoiceDetailView';
      try { await window.renderInvoiceDetailView(c, 7); } catch (e) { return 'error: ' + e.message; }
      await new Promise((r) => setTimeout(r, 600));
      // La bienvenida (onboarding, J3) sale porque el banco no trae comercio configurado: tapa la ficha.
      const onb = document.getElementById('onboarding-backdrop');
      if (onb) onb.remove();
      const mas = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '⋯');
      if (mas) mas.click();
      await new Promise((r) => setTimeout(r, 300));
      return [...document.querySelectorAll('button')].map((b) => b.textContent.trim()).join(' | ');
    });
    const f = path.join(AQUI, `1810b-${nombre}-pagado-${ancho}.png`);
    // Sin fullPage: el popover de escritorio se cierra con el scroll que hace la captura de página entera.
    await pag.screenshot({ path: f, fullPage: false });
    console.log(`${nombre} ${ancho}px → ${path.basename(f)} · botones: ${rotulos}`);
    await pag.close();
  }
}
await nav.close();
srv.close();
