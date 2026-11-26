// SCRUM-1840 · r42 EN VIVO: «📲 Confirmar Bizum recibido» NO aparece con el cobro cancelado (ficha del
// trabajo, pestaña «Facturas»), y SÍ con el pendiente (control positivo).
// Uso: node r42-1840-bizum.mjs <raizDelWorktree> <dirSalida>
// yaqu.app sirve TODO (nada local: se mide lo desplegado de #3442). La respuesta del GET
// `/admin/jobs/1840` se sustituye por un trabajo de EJEMPLO (los datos de `scripts/capturas-1840-
// bizum-oculto.mjs`) con su factura en `cancelled` o en `pending`. Toda escritura (no-GET) se
// intercepta y NO llega a prod; el informe las lista. No se pulsa el botón.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const [raiz, salida] = process.argv.slice(2).map((p) => path.resolve(p));
const requiere = createRequire(path.join('D:/MILLONARIO/cobroFlash/cobroflash-backend', 'node_modules/'));
const puppeteer = requiere('puppeteer-core');
const { abrirNavegador } = await import(pathToFileURL(path.join(raiz, 'scripts/_banco-lista.mjs')).href);

const BASE = 'https://yaqu.app';
const cookie = fs.readFileSync('C:/Users/Admin/.yaqu-qa-sesion.txt', 'utf8').trim();
const [cNombre, ...cResto] = cookie.split('=');
fs.mkdirSync(salida, { recursive: true });
const BIZUM = '📲 Confirmar Bizum recibido';

const trabajo = (estadoDelCobro) => ({
  id: 1840, status: 'en_curso', createdAt: '2026-11-20T09:00:00Z', titulo: 'Cambio de caldera (EJEMPLO)',
  customer: { id: 3, name: 'Cliente de EJEMPLO', phone: '34000000001', mobile: null },
  asignados: [], operario: null, gastos: [], notes: '', albaranes: [], partes: [],
  quote: null, direccion: null, totalAceptado: 1250, totalCobrado: 0, estadoCobro: 'Pendiente',
  tipoOperacion: 'OPERACIONES_SUELTAS',
  invoices: [{
    id: 84, number: 'F-2026-0084', status: 'pending', type: 'F1', total: 1250, currency: 'EUR',
    createdAt: '2026-11-21T10:00:00.000Z', paidAt: null, chargeId: 78, payToken: 'tok-r42-1840',
    stageLabel: null, rectifiesId: null, envioDocumento: null, conIvaAlDiez: false, metodosConAvisoIvaAlDiez: ['cash'],
    estadoDelCobro,
  }],
});
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

const informe = [];
const { browser } = await abrirNavegador(puppeteer);
try {
  for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
    for (const estado of ['cancelled', 'pending']) {
      const page = await browser.newPage();
      await page.setViewport({ width: ancho, height: alto });
      await page.setCookie({ name: cNombre, value: cResto.join('='), domain: 'yaqu.app', path: '/', secure: true, httpOnly: true });
      await page.setBypassServiceWorker(true);
      await page.setRequestInterception(true);
      const escrituras = [];
      let inyectado = 0;
      page.on('request', (req) => {
        const u = new URL(req.url());
        if (u.origin === BASE && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) {
          escrituras.push(`${req.method()} ${u.pathname}`);
          return req.respond({ status: 200, contentType: 'application/json', body: '{}' });
        }
        if (u.origin === BASE && req.method() === 'GET' && /^\/admin\/jobs\/1840(\/|$)/.test(u.pathname)) {
          inyectado++;
          const cuerpo = u.pathname === '/admin/jobs/1840' ? trabajo(estado) : [];
          return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) });
        }
        return req.continue();
      });
      const errores = [];
      page.on('pageerror', (e) => errores.push(String(e.message || e)));
      await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle2', timeout: 60000 });
      const desplegado = await page.evaluate(async () => {
        const r = await fetch('/dashboard/js/jobDetailView.js', { cache: 'no-store' });
        return r.ok ? await r.text() : '';
      });
      await page.evaluate(() => window.renderAppView('jobs-detail', { jobId: 1840 }));
      await espera(1500);
      const pestana = await page.evaluate(() => {
        const b = [...document.querySelectorAll('#view-container button, #view-container [role="tab"]')]
          .find((x) => x.textContent.trim() === 'Facturas' && x.getBoundingClientRect().width > 0);
        if (b) b.click();
        return !!b;
      });
      await espera(800);
      const m = await page.evaluate((texto) => {
        const vis = (n) => { const r = n.getBoundingClientRect(); return !n.hidden && r.width > 0 && r.height > 0; };
        const fila = document.querySelector('#view-container .jobdet-inv-actions');
        if (fila) fila.scrollIntoView({ block: 'center', behavior: 'instant' });
        const con = [...document.querySelectorAll('body *')].filter((n) => vis(n) && n.textContent.trim() === texto);
        const a = con.filter((n) => !con.some((o) => o !== n && n.contains(o)))[0] || null;
        const r = a ? a.getBoundingClientRect() : null;
        return {
          hayFila: !!fila,
          visible: !!a,
          caja: r ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null,
          desborda: document.documentElement.scrollWidth > window.innerWidth,
        };
      }, BIZUM);
      await espera(300);
      await page.screenshot({ path: path.join(salida, `r42-1840-${estado}-${ancho}.png`) });
      informe.push({
        ancho, estado, debeVerse: estado === 'pending',
        desplegadoLlevaLaCondicion: desplegado.includes("estadoDelCobro === 'pending'"),
        pestana, inyectado, escrituras, errores, ...m,
      });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(informe, null, 1));
