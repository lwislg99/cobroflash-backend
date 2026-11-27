// SCRUM-1805e · capturas ANTES/DESPUÉS de los conceptos de la ficha del presupuesto, a 390 y 1280, sobre
// https://yaqu.app con la cuenta +qa.
// Uso: node captura-1805e-ficha-presupuesto.mjs <raizDelWorktree> <dirSalida>
// ANTES = lo desplegado tal cual. DESPUÉS = `quotesDetailView.js` y `styles.css` servidos desde el ÁRBOL
// LOCAL por interceptación. En los dos, el GET `/admin/quotes/1805` se sustituye por un presupuesto de
// EJEMPLO (con un concepto largo y un importe de 9.999,99 € para el checklist AB6). Toda escritura (no-GET)
// se intercepta y NO llega a prod.
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

const LOCALES = {
  '/dashboard/js/quotesDetailView.js': ['public/dashboard/js/quotesDetailView.js', 'application/javascript'],
  '/dashboard/css/styles.css': ['public/dashboard/css/styles.css', 'text/css'],
};
const FICHA = {
  id: 1805, number: 1805, quoteNumber: 1805, revision: 0, numeroConRevision: 'P1805', revisiones: [], vigenteId: 1805,
  status: 'draft', archivedAt: null, total: 12232.89, currency: 'EUR', payToken: 'tok-ejemplo-1805e',
  lines: [
    { apartado: true, concept: 'Baño (EJEMPLO)' },
    { concept: 'Alicatado completo de paredes con azulejo porcelánico rectificado 30×60, incluido material de agarre y rejuntado', qty: 1, price: 9999.99, tax: 0.21 },
    { concept: 'Grifo monomando', qty: 2, price: 55, tax: 0.10 },
  ],
  discountGlobalAmount: null,
  createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-01T10:00:00.000Z',
  customer: { id: 3, name: 'Cliente de EJEMPLO', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'PruebaQA', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
  docHeaderText: null, docFooterText: null,
};
const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

const informe = [];
const { browser } = await abrirNavegador(puppeteer);
try {
  for (const lado of ['antes', 'despues']) {
    for (const [ancho, alto] of [[390, 844], [1280, 900]]) {
      const page = await browser.newPage();
      await page.setViewport({ width: ancho, height: alto });
      await page.setCookie({ name: cNombre, value: cResto.join('='), domain: 'yaqu.app', path: '/', secure: true, httpOnly: true });
      await page.setBypassServiceWorker(true);
      await page.setRequestInterception(true);
      const escrituras = [];
      const servidosLocales = new Set();
      page.on('request', (req) => {
        const u = new URL(req.url());
        if (u.origin === BASE && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) {
          escrituras.push(`${req.method()} ${u.pathname}`);
          return req.respond({ status: 200, contentType: 'application/json', body: '{}' });
        }
        if (u.origin === BASE && req.method() === 'GET' && u.pathname === '/admin/quotes/1805') {
          return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(FICHA) });
        }
        const local = lado === 'despues' && u.origin === BASE && LOCALES[u.pathname];
        if (local) {
          servidosLocales.add(u.pathname);
          return req.respond({ status: 200, contentType: local[1], body: fs.readFileSync(path.join(raiz, local[0])) });
        }
        return req.continue();
      });
      const errores = [];
      page.on('pageerror', (e) => errores.push(String(e.message || e)));
      await page.goto(`${BASE}/dashboard/`, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.evaluate(() => window.renderAppView('quotes-detail', { quoteId: 1805 }));
      await page.waitForSelector('#view-container table.table', { timeout: 30000 });
      await espera(800);
      const medida = await page.evaluate(() => {
        const caja = (n) => { const q = n.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width), Math.round(q.height)]; };
        const tabla = [...document.querySelectorAll('#view-container table.table')]
          .find((t) => [...t.querySelectorAll('thead th')].map((x) => x.textContent.trim()).join('|') === 'Concepto|Cant.|Precio|IVA|Total');
        if (!tabla) return { tabla: false };
        tabla.scrollIntoView({ block: 'start' });
        const fila = [...tabla.querySelectorAll('tbody tr')].find((tr) => tr.children.length === 5);
        // Una celda «se ve» si cae dentro de la ventana Y dentro de la caja visible de la tabla (su scroll propio).
        const qt = tabla.getBoundingClientRect();
        const vistas = [...fila.children].filter((td) => {
          const q = td.getBoundingClientRect();
          return q.width > 0 && q.left >= Math.max(0, qt.left) - 1 && q.right <= Math.min(window.innerWidth, qt.right) + 1;
        }).length;
        const total = fila.children[4];
        return {
          tabla: true,
          celdasALaVista: vistas,
          scrollPropioPx: tabla.scrollWidth - tabla.clientWidth,
          desbordaPagina: document.documentElement.scrollWidth > window.innerWidth,
          totalTexto: total.textContent.trim(),
          totalAlineado: getComputedStyle(total).textAlign,
          cabeceraVisible: getComputedStyle(tabla.querySelector('thead')).display !== 'none',
          cajaFila: caja(fila),
        };
      });
      await espera(300);
      await page.screenshot({ path: path.join(salida, `captura-1805e-${lado}-${ancho}.png`) });
      informe.push({ lado, ancho, servidosLocales: [...servidosLocales], escrituras, errores, ...medida });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(informe, null, 1));
