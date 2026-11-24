// tests/scrum1794b-detalle-de-la-factura-exportado.test.mjs — SCRUM-1794b
//
// LA TABLA DE LÍNEAS Y EL DESGLOSE DE LA FACTURA, COMO FUNCIÓN PURA EXPORTADA.
//
// Decisión del orquestador J en SCRUM-1794 c.22461 (punto 3), sobre la medición de c.22459: J2 exporta
// `detalleDeLaFactura` (vivía sin exportar en `payInvoice.routes.ts`, SCRUM-1787h) para que S1 la llame
// desde el correo de la factura sin reescribirla. Sin cambio en lo que pinta la página de pago.
//
// CARACTERIZACIÓN (patrón de 1787u): el ORO de abajo se capturó de la página de pago ANTES de extraer la
// función (origin/main 42cae61092ba69761d6d7bba0504abe6baee1e52), con la ruta real y tres facturas. Es el
// trozo que la página pinta entre el importe y «Elige cómo pagar». Ahora se comprueba que la función
// devuelve ese oro y que la página lo sigue devolviendo.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
const R_INVOICE = require_.resolve('./dist/modules/billing/app/routes/payInvoice.routes.js');
// Ruta a mano, no `require.resolve`: así el fichero carga también antes de que el módulo exista
// (la caracterización de ① se corrió sobre la página sin extraer).
const R_DETALLE = path.join(RAIZ, 'dist', 'modules', 'billing', 'app', 'routes', 'detalleDeLaFactura.js');

// Mutaciones que este fichero tiene que tumbar (catálogo del meta-guard, SCRUM-1731). Cada campo, LITERAL.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // «La página vuelve a pintar EN LÍNEA»: deja de importar la función y lleva su propia copia. El oro
    // sigue saliendo; lo que cae es ③, porque la página ya no pinta lo que devuelve la función.
    fichero: 'src/modules/billing/app/routes/payInvoice.routes.ts',
    de: "import { detalleDeLaFactura } from './detalleDeLaFactura'; // SCRUM-1794b",
    a: "import { pieDePresupuesto } from '../../../quotes/domain/presentacionIva';\nfunction detalleDeLaFactura(invoice: { total: unknown; lines: unknown } | null, importeDelCobro: number | null, currency: string): string {\n  const lineas: any[] = Array.isArray(invoice?.lines) ? (invoice!.lines as any[]) : [];\n  if (lineas.length === 0) return '';\n  const money = (n: number) => esc(formatMoneyEs(n, currency));\n  const pie = pieDePresupuesto({ lineas, modo: 'sumar', nombreImpuesto: 'IVA' });\n  const desdeBase = pie.filas.findIndex((f) => f.etiqueta === 'Base imponible:');\n  if (desdeBase < 0) return '';\n  const suma = pie.filas.slice(desdeBase).reduce((s, f) => s + f.importe, 0);\n  const total = Number(invoice!.total);\n  const cuadra = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.005;\n  if (!cuadra(suma, total)) return '';\n  if (importeDelCobro !== null && !cuadra(importeDelCobro, total)) return '';\n  const rot = (e: string) => { const s = e.endsWith(':') ? e.slice(0, -1) : e; return s.startsWith('IVA ') && s.endsWith('%') ? `IVA (${s.slice(4)})` : s; };\n  const imp = (l: any) => { const n = Number(l?.qty) * Number(l?.price); return l?.qty != null && l?.price != null && Number.isFinite(n) ? money(n) : ''; };\n  return `\n    <table class=\"lines-table\">\n      <thead><tr><th>Concepto</th><th>Cant.</th><th>Importe</th></tr></thead>\n      <tbody>${lineas.map((l: any) => `\n        <tr>\n          <td>${esc(l?.concept ?? '')}</td>\n          <td>${esc(l?.qty ?? '')}</td>\n          <td>${imp(l)}</td>\n        </tr>`).join('')}\n      </tbody>\n    </table>\n    <div class=\"totals-block\">\n      ${pie.filas.map((f) => `\n      <div class=\"totals-row\"><span>${esc(rot(f.etiqueta))}</span><span>${money(f.importe)}</span></div>`).join('')}\n    </div>`;\n}",
    cae: 'SCRUM-1794b · ③ la página pinta lo que devuelve la función (no la pinta en línea)',
  },
  {
    // «La función ignora que no cuadra»: base + IVA ≠ total de la factura y aun así pinta la tabla.
    fichero: 'src/modules/billing/app/routes/detalleDeLaFactura.ts',
    de: "  if (!cuadra(sumaDelDesglose, totalFactura)) return '';",
    a: '',
    cae: 'SCRUM-1794b · ② la función, sin cobro (el correo): no pinta nada si base + IVA no es el total',
  },
];

// ── Las tres facturas del encargo ─────────────────────────────────────────────────────────────────
const TRES = [
  { concept: 'Mano de obra fontanería', qty: 2, price: 45, tax: 0.21 },
  { concept: 'Grifo monomando', qty: 1, price: 60, tax: 0.21 },
  { concept: 'Desplazamiento', qty: 1, price: 15, tax: 0.21 },
];
const FACTURAS = {
  // 2 × 45 + 60 + 15 = 165,00 de base; 21 % → 34,65; total 199,65. CUADRA.
  tresLineas: { total: 199.65, lines: TRES },
  // Las mismas líneas (199,65) y la factura dice 250: NO CUADRA → la página no pinta nada.
  noCuadra: { total: 250, lines: TRES },
  // Descuento de LÍNEA (`dto` 10 % sobre 200): suma 280, descuento 20, base 260, IVA 54,60, total 314,60.
  conDescuento: { total: 314.6, lines: [
    { concept: 'Caldera de condensación', qty: 1, price: 200, tax: 0.21, dto: 10 },
    { concept: 'Mano de obra', qty: 2, price: 40, tax: 0.21 },
  ] },
};

// El ORO, capturado de la página ANTES de la extracción (ver cabecera). Literal: no se regenera.
const ORO = {
  tresLineas: "\n    <table class=\"lines-table\">\n      <thead><tr><th>Concepto</th><th>Cant.</th><th>Importe</th></tr></thead>\n      <tbody>\n        <tr>\n          <td>Mano de obra fontanería</td>\n          <td>2</td>\n          <td>90,00\u00a0€</td>\n        </tr>\n        <tr>\n          <td>Grifo monomando</td>\n          <td>1</td>\n          <td>60,00\u00a0€</td>\n        </tr>\n        <tr>\n          <td>Desplazamiento</td>\n          <td>1</td>\n          <td>15,00\u00a0€</td>\n        </tr>\n      </tbody>\n    </table>\n    <div class=\"totals-block\">\n      \n      <div class=\"totals-row\"><span>Base imponible</span><span>165,00\u00a0€</span></div>\n      <div class=\"totals-row\"><span>IVA (21%)</span><span>34,65\u00a0€</span></div>\n    </div>",
  noCuadra: '',
  conDescuento: "\n    <table class=\"lines-table\">\n      <thead><tr><th>Concepto</th><th>Cant.</th><th>Importe</th></tr></thead>\n      <tbody>\n        <tr>\n          <td>Caldera de condensación</td>\n          <td>1</td>\n          <td>200,00\u00a0€</td>\n        </tr>\n        <tr>\n          <td>Mano de obra</td>\n          <td>2</td>\n          <td>80,00\u00a0€</td>\n        </tr>\n      </tbody>\n    </table>\n    <div class=\"totals-block\">\n      \n      <div class=\"totals-row\"><span>Suma de líneas</span><span>280,00\u00a0€</span></div>\n      <div class=\"totals-row\"><span>Descuento</span><span>-20,00\u00a0€</span></div>\n      <div class=\"totals-row\"><span>Base imponible</span><span>260,00\u00a0€</span></div>\n      <div class=\"totals-row\"><span>IVA (21%)</span><span>54,60\u00a0€</span></div>\n    </div>",
};

const M = { id: 42, name: 'Fontanería Ruiz', legalName: 'Fontanería Ruiz SL', country: 'ES', logoUrl: null,
  iban: 'ES9121000418450200051332', clabe: null, bizumPhone: null, whatsappPhone: null,
  connectStatus: 'none', stripeAccountId: null, flags: null };

/** Pide la página de pago del cobro (por el importe de la factura) y devuelve el trozo entre el
 *  importe y «Elige cómo pagar», que es exactamente lo que pinta `detalleHtml`. */
async function trozoDeLaPagina(factura, importeDelCobro = factura.total) {
  const ch = { id: 7, merchantId: 42, receiptToken: 'tok1794b', status: 'pending', amount: importeDelCobro,
    currency: 'EUR', concept: 'Reparación de bajante', payMethods: null, merchant: M };
  delete require_.cache[R_INVOICE];
  require_.cache[R_PRISMA] = {
    id: R_PRISMA, filename: R_PRISMA, loaded: true,
    exports: { prisma: {
      charge: { findUnique: async () => ch },
      invoice: { findFirst: async () => ({ merchantId: 42, chargeId: 7, number: 'F-2026-0007', dueDate: null, ...factura }) },
    } },
  };
  const app = require_('express')();
  app.use('/pay', require_(R_INVOICE).default);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  // `node:http` sin agente, no `fetch` (0xC0000409 con `--test-force-exit`: SCRUM-1204).
  const { status, html } = await new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path: '/pay/invoice/tok1794b', agent: false }, (res) => {
      const t = [];
      res.on('data', (c) => t.push(c));
      res.on('end', () => resolve({ status: res.statusCode, html: Buffer.concat(t).toString('utf8') }));
    }).on('error', reject);
  });
  await new Promise((r) => server.close(r));
  // SUELO: la página se pintó. Un 500 tampoco tiene tabla, y sería un verde sobre nada.
  assert.equal(status, 200, `🔴 CIEGO: la página devolvió HTTP ${status}.`);
  // Sin el `>` pegado (SCRUM-553): una clase o un `id` añadidos a la etiqueta no la esconden.
  const a = html.indexOf('<div class="amount-wrap"');
  const CIERRE = '    </div>\n    ';
  const ini = html.indexOf(CIERRE, a);
  const fin = html.indexOf('\n\n    <div class="methods-label"', ini);
  assert.ok(a >= 0 && ini > a && fin >= ini + CIERRE.length,
    `🔴 CIEGO: no encuentro el hueco entre el importe y «Elige cómo pagar» (a=${a}, ini=${ini}, fin=${fin}).`);
  return html.slice(ini + CIERRE.length, fin);
}

test('SCRUM-1794b · control: el oro no es vacío donde la factura cuadra (si no, todo lo de abajo compara nada)', () => {
  assert.ok(ORO.tresLineas.includes('Grifo monomando') && ORO.tresLineas.includes('Base imponible'));
  assert.ok(ORO.conDescuento.includes('Descuento') && ORO.conDescuento.includes('Caldera de condensación'));
  assert.equal(ORO.noCuadra, '');
});

test('SCRUM-1794b · ① la página de pago sigue pintando el oro, factura a factura', async () => {
  for (const [caso, factura] of Object.entries(FACTURAS)) {
    assert.equal(await trozoDeLaPagina(factura), ORO[caso], `🔴 ${caso}: la página ya no pinta lo que pintaba.`);
  }
});

test('SCRUM-1794b · ② la función devuelve el oro, factura a factura (con el importe del cobro)', () => {
  const { detalleDeLaFactura } = require_(R_DETALLE);
  for (const [caso, factura] of Object.entries(FACTURAS)) {
    assert.equal(detalleDeLaFactura(factura, factura.total, 'EUR'), ORO[caso], `🔴 ${caso}`);
  }
  // Y sigue sin pintar si el cobro no es la factura entera (1787h).
  assert.equal(detalleDeLaFactura(FACTURAS.tresLineas, 100, 'EUR'), '');
  assert.equal(detalleDeLaFactura(null, 0, 'EUR'), '');
  assert.equal(detalleDeLaFactura({ total: 0, lines: [] }, 0, 'EUR'), '');
});

test('SCRUM-1794b · ② la función, sin cobro (el correo): no pinta nada si base + IVA no es el total', () => {
  const { detalleDeLaFactura } = require_(R_DETALLE);
  // POSITIVO primero: sin cobro y cuadrando, el MISMO oro que la página.
  assert.equal(detalleDeLaFactura(FACTURAS.tresLineas, null, 'EUR'), ORO.tresLineas);
  assert.equal(detalleDeLaFactura(FACTURAS.conDescuento, null, 'EUR'), ORO.conDescuento);
  assert.equal(detalleDeLaFactura(FACTURAS.noCuadra, null, 'EUR'), '',
    '🔴 Las líneas suman 199,65 € y la factura dice 250 €: la tabla contradiría el total.');
});

test('SCRUM-1794b · ③ la página pinta lo que devuelve la función (no la pinta en línea)', async () => {
  const llamadas = [];
  const MARCA = '\n    <p class="marca-1794b">DOBLE</p>';
  require_.cache[R_DETALLE] = {
    id: R_DETALLE, filename: R_DETALLE, loaded: true,
    exports: { detalleDeLaFactura: (...args) => { llamadas.push(args); return MARCA; } },
  };
  try {
    assert.equal(await trozoDeLaPagina(FACTURAS.noCuadra), MARCA,
      '🔴 La página no pinta lo que devuelve `detalleDeLaFactura`: lo decide ella.');
    assert.equal(llamadas.length, 1, 'la página llama a la función UNA vez por petición');
    assert.deepEqual(llamadas[0][0].lines, FACTURAS.noCuadra.lines, 'le pasa la factura leída');
    assert.equal(llamadas[0][1], 250, 'y el importe del cobro, en número');
    assert.equal(llamadas[0][2], 'EUR');
  } finally {
    delete require_.cache[R_DETALLE];
    delete require_.cache[R_INVOICE];
  }
});
