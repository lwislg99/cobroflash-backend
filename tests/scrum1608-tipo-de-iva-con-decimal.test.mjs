// tests/scrum1608-tipo-de-iva-con-decimal.test.mjs — SCRUM-1608
//
// Sin gate: el banco de vistas con la red doblada, y `calcTotal` de `dist/`. Ni BD, ni red real.
//
// El tipo de IVA se redondeaba a ENTERO en cuatro sitios del panel: un 7,5 % (que el selector acepta
// desde SCRUM-1447) se pintaba «8 %». El PDF ya no lo hace desde 1447, y su convención es la que se
// copia: `rotuloDeTipo(tipoEnPorcentaje(x))` — el tipo a la centésima de punto, con coma decimal. En
// el front, su gemela es `fmtTipoIvaEs` (`api.js`).
//
// Tres sitios sólo PINTAN (asistente de IA, Productos, ficha del presupuesto). El cuarto,
// `quoteDescuentos.js`, METÍA el tipo redondeado en una CUENTA: con descuento global, la pantalla
// quitaba el global con `1 + 8/100`. Medido el 27-oct-2026 sobre origin/main ce1111a68, pantalla
// contra `calcTotal`: 967,00 / 967,50 · 249,90 / 250,09 · 737,50 / 738,50. Lo GUARDADO (y el PDF)
// ya estaba bien: el servidor calcula el total él solo (`quotesView.js`, payload: «`calcTotal` lo
// aplica en el servidor… la pantalla sólo lo previsualiza»).
//
// Aceptación (orquestador, 27-oct-2026, por SendMessage a S2):
//   ① con un 7,5 % las tres pantallas pintan «7,5 %», y un 21 % sigue «21 %», por efecto en el banco;
//   ② con 7,5 % y descuento global, el total de pantalla = `calcTotal`;
//   ③ lo guardado es idéntico antes y después, en los seis casos.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { calcTotal } from '../dist/core/utils/utils.js';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/api.js',
    de: 'return fmtNumeroEs(Number.isFinite(v) ? Math.round(v * 10000) / 100 : 0);',
    a: 'return fmtNumeroEs(Number.isFinite(v) ? Math.round(v * 100) : 0);',
    cae: 'SCRUM-1608 ① ·',
  },
  {
    fichero: 'public/dashboard/js/aiQuoteAssistant.js',
    de: ' · IVA: ${fmtTipoIvaEs(line.tax)}%',
    a: ' · IVA: ${(line.tax * 100).toFixed(0)}%',
    cae: 'SCRUM-1608 ① · asistente',
  },
  {
    fichero: 'public/dashboard/js/productsView.js',
    de: ': fmtTipoIvaEs(it.vat) + " %";',
    a: ': (Number(it.vat) * 100).toFixed(0) + " %";',
    cae: 'SCRUM-1608 ① · Productos',
  },
  {
    fichero: 'public/dashboard/js/quotesDetailView.js',
    de: '`<td>${fmtTipoIvaEs(tax)} %</td>` +',
    a: '`<td>${(tax * 100).toFixed(0)} %</td>` +',
    cae: 'SCRUM-1608 ① · ficha',
  },
  {
    fichero: 'public/dashboard/js/quoteDescuentos.js',
    de: 'const rate = Math.round(tax * 10000) / 100;',
    a: 'const rate = Math.round(tax * 100);',
    cae: 'SCRUM-1608 ② ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const respirar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };
const NAV = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
const resp = (status, data) => ({
  ok: status >= 200 && status < 300, status, statusText: String(status),
  headers: { get: () => 'application/json' },
  json: async () => data, text: async () => JSON.stringify(data), blob: async () => ({}),
});
const textoDe = (raiz) => todos(raiz).map((n) => String(n.textContent || '')).join(' ').replace(/\s+/g, ' ');

// ── ① LAS TRES PANTALLAS QUE PINTAN ─────────────────────────────────────────────────────────

test('SCRUM-1608 ① · asistente de IA: un 7,5 % se pinta «7,5%» y un 21 % sigue «21%»', async () => {
  const fetch = async (url) => (/\/admin\/ai\/suggest-quote$/.test(String(url))
    ? resp(200, { lines: [
      { concept: 'Línea sembrada 1608 A', qty: 1, price: 100, tax: 0.075, supuestos: [] },
      { concept: 'Línea sembrada 1608 B', qty: 1, price: 100, tax: 0.21, supuestos: [] },
    ], descartadas: [] })
    : resp(200, {}));
  const b = cargarDashboard(RAIZ, { rol: 'admin', red: { navigator: NAV, fetch } });
  assert.equal(typeof b.ctx.openAiSuggestModal, 'function', '🔴 NO PUDE MIRAR: el banco no carga `openAiSuggestModal`.');
  b.ctx.openAiSuggestModal(() => {});
  const doc = b.ctx.document;
  const ta = doc.querySelector('#ai-description');
  const btn = doc.querySelector('#ai-suggest-btn');
  assert.ok(ta && btn, '🔴 NO PUDE MIRAR: el modal no tiene descripción o botón en el banco.');
  ta.value = 'Cambiar el grifo de la cocina';
  await btn.onclick();
  await respirar();
  const texto = textoDe(doc.body);
  assert.match(texto, /Línea sembrada 1608 A/, `🔴 NO PUDE MIRAR: las sugerencias no se pintan: «${texto.slice(0, 300)}».`);
  assert.match(texto, /IVA: 7,5%/, `🔴 asistente: un 7,5 % no se pinta «7,5%»: «${texto.slice(0, 400)}».`);
  assert.doesNotMatch(texto, /IVA: 8%/, '🔴 asistente: un 7,5 % se sigue pintando «8%».');
  assert.match(texto, /IVA: 21%/, '🔴 asistente: CONTROL — un 21 % ha dejado de pintarse «21%».');
});

test('SCRUM-1608 ① · Productos: la columna IVA pinta «7,5 %» y un 21 % sigue «21 %»', async () => {
  const producto = (id, nombre, vat) => ({ id, name: nombre, description: '', price: 10, cost: null, vat, isActive: true, provider: null });
  const fetch = async (url) => {
    const u = new URL(String(url), 'https://yaqu.app').pathname;
    if (u === '/admin/merchant') return resp(200, { id: 1, name: 'Taller', defaultCurrency: 'EUR', country: 'ES' });
    if (u === '/admin/products') return resp(200, { ok: true, items: [producto(1, 'Producto 1608 A', 0.075), producto(2, 'Producto 1608 B', 0.21)] });
    return resp(200, { ok: true, items: [] });
  };
  const b = cargarDashboard(RAIZ, { rol: 'admin', red: { navigator: NAV, fetch } });
  b.ctx.appMerchantId = 1;
  const v = await pintarVista(b, 'renderProductsView');
  assert.ok(!v.error, `🔴 NO PUDE MIRAR: Productos no monta: ${v.error && v.error.message}`);
  await respirar();
  const filas = todos(v.contenedor).filter((n) => n.tagName === 'TR' && /Producto 1608/.test(textoDe(n)));
  assert.equal(filas.length, 2, `🔴 NO PUDE MIRAR: Productos pinta ${filas.length} filas sembradas, no 2.`);
  const celdas = (fila) => todos(fila).filter((n) => n.tagName === 'TD').map((n) => textoDe(n).trim());
  const [a, bb] = filas.map(celdas);
  assert.ok(a.includes('7,5 %'), `🔴 Productos: un 7,5 % no se pinta «7,5 %»: ${JSON.stringify(a)}.`);
  assert.ok(!a.includes('8 %'), `🔴 Productos: un 7,5 % se sigue pintando «8 %»: ${JSON.stringify(a)}.`);
  assert.ok(bb.includes('21 %'), `🔴 Productos: CONTROL — un 21 % ha dejado de pintarse «21 %»: ${JSON.stringify(bb)}.`);
});

test('SCRUM-1608 ① · ficha del presupuesto: la columna IVA pinta «7,5 %» y un 21 % sigue «21 %»', async () => {
  const ficha = {
    id: 202, number: 5, quoteNumber: 5, revision: 0, numeroConRevision: 'P5', revisiones: [], vigenteId: 202,
    status: 'draft', archivedAt: null, total: '228.50', currency: 'EUR', payToken: 'tok202',
    lines: [
      { concept: 'Concepto 1608 A', qty: 1, price: 100, tax: 0.075 },
      { concept: 'Concepto 1608 B', qty: 1, price: 100, tax: 0.21 },
    ],
    createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
    customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
    merchant: { id: 7, name: 'QA 1608', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
    charge: null, invoices: [],
    decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
    billingPlan: [], nextStage: null, hasCustomPlan: false,
    asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
    albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
    docHeaderText: null, docFooterText: null,
  };
  const fetch = async (url) => (/\/admin\/quotes\/202$/.test(new URL(String(url), 'https://yaqu.app').pathname)
    ? resp(200, ficha) : resp(200, []));
  const b = cargarDashboard(RAIZ, { red: { navigator: NAV, fetch } });
  b.ctx.appUserRole = 'admin';
  const v = await pintarVista(b, 'renderQuoteDetailView', 202);
  assert.ok(!v.error, `🔴 NO PUDE MIRAR: la ficha no monta: ${v.error && v.error.message}`);
  const filas = todos(v.contenedor).filter((n) => n.tagName === 'TR' && /Concepto 1608/.test(textoDe(n)));
  assert.equal(filas.length, 2, `🔴 NO PUDE MIRAR: la ficha pinta ${filas.length} líneas sembradas, no 2.`);
  const celdas = (fila) => todos(fila).filter((n) => n.tagName === 'TD').map((n) => textoDe(n).trim());
  const [a, bb] = filas.map(celdas);
  assert.ok(a.includes('7,5 %'), `🔴 ficha: un 7,5 % no se pinta «7,5 %»: ${JSON.stringify(a)}.`);
  assert.ok(!a.includes('8 %'), `🔴 ficha: un 7,5 % se sigue pintando «8 %»: ${JSON.stringify(a)}.`);
  assert.ok(bb.includes('21 %'), `🔴 ficha: CONTROL — un 21 % ha dejado de pintarse «21 %»: ${JSON.stringify(bb)}.`);
});

// ── ② Y ③ LA CUENTA: LOS SEIS CASOS MEDIDOS ─────────────────────────────────────────────────

// `guardado`: `calcTotal` (lo que el servidor guarda y el PDF lee), medido IGUAL sobre origin/main
// ce1111a68 y sobre esta rama — este ticket no toca `src/`. Si se mueve un céntimo, es STOP (③).
const CASOS = [
  { nombre: 'CONTROL 21 % sin global', lineas: [{ qty: 1, price: 1000, tax: 0.21 }], global: null, guardado: 1210 },
  { nombre: 'CONTROL 21 % global 100', lineas: [{ qty: 1, price: 1000, tax: 0.21 }], global: 100, guardado: 1089 },
  { nombre: '7,5 % sin global', lineas: [{ qty: 1, price: 1000, tax: 0.075 }], global: null, guardado: 1075 },
  { nombre: '7,5 % global 100', lineas: [{ qty: 1, price: 1000, tax: 0.075 }], global: 100, guardado: 967.5 },
  { nombre: '3 × 99,99 al 7,5 % dto 10 % global 37,33', lineas: [{ qty: 3, price: 99.99, tax: 0.075, dto: 10 }], global: 37.33, guardado: 250.09 },
  { nombre: '2 × 450 al 5,5 % global 200', lineas: [{ qty: 2, price: 450, tax: 0.055 }], global: 200, guardado: 738.5 },
];

test('SCRUM-1608 ② · con descuento global y tipo NO entero, el total de pantalla es el que se guarda', () => {
  const qd = require(path.join(RAIZ, 'public/dashboard/js/quoteDescuentos.js'));
  assert.equal(typeof qd.totalesConDescuento, 'function', '🔴 NO PUDE MIRAR: `quoteDescuentos` no exporta `totalesConDescuento`.');
  for (const c of CASOS) {
    const pantalla = qd.totalesConDescuento(c.lineas, c.global).totalCents / 100;
    assert.equal(pantalla.toFixed(2), Number(calcTotal(c.lineas, c.global)).toFixed(2),
      `🔴 ${c.nombre}: la pantalla da ${pantalla.toFixed(2)} y se guarda ${Number(calcTotal(c.lineas, c.global)).toFixed(2)}.`);
  }
});

test('SCRUM-1608 ③ · lo GUARDADO no se mueve: `calcTotal` da en los seis casos lo medido antes del arreglo', () => {
  for (const c of CASOS) {
    assert.equal(Number(calcTotal(c.lineas, c.global)).toFixed(2), c.guardado.toFixed(2),
      `🔴 STOP: ${c.nombre}: lo guardado era ${c.guardado.toFixed(2)} y ahora es ${Number(calcTotal(c.lineas, c.global)).toFixed(2)}.`);
  }
});
