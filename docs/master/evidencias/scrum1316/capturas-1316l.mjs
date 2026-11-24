// docs/master/evidencias/scrum1316/capturas-1316l.mjs — SCRUM-1316l · LAS CAPTURAS DE T3 Y T4 EN LA FICHA.
//
// Uso:  node docs/master/evidencias/scrum1316/capturas-1316l.mjs   →  docs/master/evidencias/scrum1316/1316l/
//
// Monta el PANEL REAL (index.html con todos sus scripts) como `scripts/guard-ficha-de-factura.mjs`,
// con una factura PENDIENTE de EJEMPLO que lleva una línea al 10 % (ninguna base: `/admin/*` lo
// contesta este banco). A 390 y a 1280:
//   · T3: pulsa «Marcar como cobrada» sin elegir cómo → la ficha dice T3 y no manda nada;
//   · T4: elige «efectivo» en el selector → sale T4 debajo.
// Además de la foto LEE la página y lo dice: si el texto no aparece, sale con 1; si no supo mirar, con 2.
// ⚠️ Una captura no prueba que el botón funcione: eso lo prueba `tests/scrum1316l-medio-de-cobro-con-iva-10.test.mjs`.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';
import { levantarServidor } from '../../../../scripts/_servidor.mjs';
import { TIPOS_DE_FUENTE, esperarFuentes } from '../../../../scripts/_hojas-del-panel.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const DESTINO = path.join(path.dirname(fileURLToPath(import.meta.url)), '1316l');

// Los literales se LEEN de la vista (no se copian): si cambian, la captura busca el texto nuevo.
const vista = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'invoicesView.js'), 'utf8');
const T3 = (/eligeMetodo: '([^']+)'/.exec(vista) || [])[1];
const T4 = (/avisoEfectivo: '([^']+)'/.exec(vista) || [])[1];
if (!T3 || !T4) { console.error('🔴 NO SUPE MIRAR: no leo T3/T4 en invoicesView.js'); process.exit(2); }

const ME = {
  id: 1, email: 'demo@yaqu.app', name: 'QA 1316l', plan: 'pro', role: 'admin',
  onboardingCompleted: true, subscriptionStatus: 'active', voiceEnabled: false,
  metodosDeclarables: [
    { valor: 'bizum_manual', rotulo: 'Bizum' }, { valor: 'card', rotulo: 'tarjeta' },
    { valor: 'transfer', rotulo: 'transferencia' }, { valor: 'cash', rotulo: 'efectivo' },
  ],
};
const FACTURA = {
  id: 1, number: 'F-2026-0001', type: 'F1', status: 'pending', currency: 'EUR',
  createdAt: '2026-11-20T10:00:00Z', paidAt: null, total: 170.5,
  customer: { id: 1, name: 'Cliente de ejemplo' }, merchant: { id: 1, name: 'QA 1316l' },
  lines: [
    { concept: 'Reforma de baño en vivienda', qty: 1, price: 100, tax: 0.1 },
    { concept: 'Material', qty: 1, price: 50, tax: 0.21 },
  ],
  quotes: [], tags: [], asignados: [],
  metodosConAvisoIvaAlDiez: ['cash'], // lo que sirve GET /admin/invoices/:id (SCRUM-1316l)
};

const pedidasStatus = [];
function arrancar() {
  const json = (res, o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (/\/status$/.test(u)) { pedidasStatus.push(u); return json(res, { ok: true }); }
    if (u === '/admin/me') return json(res, ME);
    if (u === '/admin/merchant') return json(res, { id: 1, name: 'QA 1316l', defaultCurrency: 'EUR' });
    if (u === '/admin/invoices/1') return json(res, FACTURA);
    if (u.startsWith('/admin/')) return json(res, { items: [], rows: [], data: [] });
    const f = path.join(RAIZ, 'public', u.replace(/^\//, ''));
    if (fs.existsSync(f) && fs.statSync(f).isFile()) {
      const ext = path.extname(f);
      if (TIPOS_DE_FUENTE[ext]) { res.writeHead(200, { 'content-type': TIPOS_DE_FUENTE[ext] }); return res.end(fs.readFileSync(f)); }
      const tipo = ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript' : 'text/html';
      res.writeHead(200, { 'content-type': `${tipo}; charset=utf-8` });
      return res.end(fs.readFileSync(f));
    }
    res.writeHead(404); res.end('no');
  });
  return levantarServidor(srv, 0).then((p) => ({ srv, puerto: p }));
}

const ANCHOS = [
  { nombre: '390', vp: { width: 390, height: 844, isMobile: true, hasTouch: true } },
  { nombre: '1280', vp: { width: 1280, height: 900 } },
];

fs.mkdirSync(DESTINO, { recursive: true });
const { srv, puerto } = await arrancar();
const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
let fallos = 0; let ciegos = 0;
try {
  for (const a of ANCHOS) {
    for (const caso of ['T3', 'T4']) {
      const pag = await nav.newPage();
      const errores = [];
      pag.on('pageerror', (e) => errores.push(String(e.message || e)));
      pag.on('dialog', (d) => d.dismiss()); // el prompt del importe: no debe salir en T3
      await pag.setBypassServiceWorker(true);
      await pag.setViewport(a.vp);
      await pag.goto(`http://127.0.0.1:${puerto}/dashboard/index.html#invoice-detail/1`, { waitUntil: 'networkidle0' });
      const sel = await pag.waitForSelector('#metodo-cobro-factura', { timeout: 10000 }).catch(() => null);
      await esperarFuentes(pag);
      if (!sel) { console.log(`  ? ${a.nombre} ${caso} · CIEGO: no se pinta el selector`); ciegos++; await pag.close(); continue; }
      let texto;
      if (caso === 'T3') {
        const antes = pedidasStatus.length;
        await pag.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Marcar como cobrada');
          if (b) b.click();
        });
        await new Promise((r) => setTimeout(r, 300));
        texto = T3;
        if (pedidasStatus.length !== antes) { console.log(`  ✖ ${a.nombre} T3 · se mandó el PUT sin medio`); fallos++; }
      } else {
        await pag.select('#metodo-cobro-factura', 'cash');
        await new Promise((r) => setTimeout(r, 200));
        texto = T4;
      }
      const visible = await pag.evaluate((t) => [...document.querySelectorAll('body *')].some((n) => {
        if (n.children.length || (n.textContent || '').indexOf(t) === -1) return false;
        const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !n.closest('[hidden]');
      }), texto);
      // Se lleva a la vista la zona del selector, que es donde salen los dos textos.
      await pag.evaluate(() => document.getElementById('metodo-cobro-factura').scrollIntoView({ block: 'center' }));
      const fichero = path.join(DESTINO, `${caso}-${a.nombre}.png`);
      await pag.screenshot({ path: fichero });
      console.log(`  ${visible ? '✔' : '✖'} ${a.nombre} ${caso} · ${visible ? 'se ve' : 'NO se ve'} · ${path.relative(RAIZ, fichero)}${errores.length ? ' · errores: ' + errores.join(' | ') : ''}`);
      if (!visible) fallos++;
      await pag.close();
    }
  }
} finally {
  await nav.close();
  srv.close();
}
process.exit(ciegos ? 2 : fallos ? 1 : 0);
