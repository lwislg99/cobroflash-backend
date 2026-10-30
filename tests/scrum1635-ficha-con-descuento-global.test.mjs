// SCRUM-1635 · La ficha del presupuesto pinta el DESCUENTO GLOBAL.
//
// Sin gate: el banco de vistas con la red doblada. Ni BD, ni red real.
//
// Medido por S4 en yaqu.app (#212 de QA, 29-oct): 10 × 100 € al 7,5 % con 100 € de descuento
// global. La ficha pintaba la línea (1.075,00 €), «Base imponible», «IVA» y «Total: 967,50 €», y
// NADA que explicara los 100 €. La vista previa del editor sí lo explica, con las filas del pie del
// PDF y de la página de firma (SCRUM-888 c.15788, `docs/microcopy/2026-09-17-SCRUM-888-…`).
//
// Lo que se exige, por efecto en la ficha montada:
//   ① con descuento global: «Suma de líneas: 1.000,00» y «Descuento global: −100,00» delante de
//      «Base imponible», y las cifras CUADRAN: suma − descuento = base, y base + IVA = total;
//   ② CONTROL — sin descuento global (ni de línea), la ficha no gana ninguna fila;
//   ③ CONTROL — con descuento SÓLO de línea tampoco: la columna de la línea ya lo lleva dentro y no
//      queda nada sin explicar (la aceptación: «sin descuento global no gana ninguna fila»).

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

// El catálogo del meta-guard (`scripts/meta-guard-mutaciones.mjs`, SCRUM-1387).
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'public/dashboard/js/quotesDetailView.js',
    de: 'const pintaDesglose = desglose.descuentoGlobalCents > 0;',
    a: 'const pintaDesglose = false;',
    cae: 'SCRUM-1635 ① ·',
  },
  {
    fichero: 'public/dashboard/js/quotesDetailView.js',
    de: 'const pintaDesglose = desglose.descuentoGlobalCents > 0;',
    a: 'const pintaDesglose = desglose.descuentoGlobalCents > 0 || desglose.descuentoLineasCents > 0;',
    cae: 'SCRUM-1635 ③ ·',
  },
];

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const NAV = { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } };
const resp = (status, data) => ({
  ok: status >= 200 && status < 300, status, statusText: String(status),
  headers: { get: () => 'application/json' },
  json: async () => data, text: async () => JSON.stringify(data), blob: async () => ({}),
});
const textoDe = (raiz) => todos(raiz).map((n) => String(n.textContent || '')).join(' ').replace(/\s+/g, ' ');

const ficha = (id, lineas, total, discountGlobalAmount) => ({
  id, number: id, quoteNumber: id, revision: 0, numeroConRevision: `P${id}`, revisiones: [], vigenteId: id,
  status: 'draft', archivedAt: null, total, currency: 'EUR', payToken: `tok${id}`,
  lines: lineas, discountGlobalAmount,
  createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-10-01T10:00:00.000Z',
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1635', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: null, rejectedAt: null, decisionChannel: null, decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
  docHeaderText: null, docFooterText: null,
});

// Monta la ficha y devuelve las filas del bloque de totales, como «rótulo: importe» por fila.
async function filasDeTotales(q) {
  const fetch = async (url) => (new URL(String(url), 'https://yaqu.app').pathname === `/admin/quotes/${q.id}`
    ? resp(200, q) : resp(200, []));
  const b = cargarDashboard(RAIZ, { red: { navigator: NAV, fetch } });
  b.ctx.appUserRole = 'admin';
  const v = await pintarVista(b, 'renderQuoteDetailView', q.id);
  assert.ok(!v.error, `🔴 NO PUDE MIRAR: la ficha no monta: ${v.error && v.error.message}`);
  // El bloque de totales es el padre de la fila «Total:», que existe con o sin descuento.
  const filaTotal = todos(v.contenedor).find((n) => n.tagName === 'DIV' && /^\s*Total:/.test(textoDe(n))
    && !todos(n).some((h) => h !== n && h.tagName === 'DIV'));
  assert.ok(filaTotal && filaTotal.parentNode, `🔴 NO PUDE MIRAR: la ficha no pinta la fila «Total:»: «${textoDe(v.contenedor).slice(0, 300)}».`);
  return (filaTotal.parentNode.children || []).map((n) => textoDe(n).trim());
}

const cifra = (fila) => Number(String(fila.split(':').slice(1).join(':')).replace(/[^\d,−-]/g, '').replace(/\./g, '').replace(',', '.').replace('−', '-'));

test('SCRUM-1635 ① · con descuento global, la ficha pinta «Suma de líneas» y «Descuento global», y las cifras cuadran', async () => {
  // El caso de #212: 10 × 100 € al 7,5 %, global 100 € → guardado 967,50.
  const filas = await filasDeTotales(ficha(212, [{ concept: 'Concepto 1635', qty: 10, price: 100, tax: 0.075 }], '967.50', '100'));
  const rotulos = filas.map((f) => f.split(':')[0].trim());
  assert.deepEqual(rotulos, ['Suma de líneas', 'Descuento global', 'Base imponible', 'IVA', 'Total'],
    `🔴 la ficha no explica el descuento global: ${JSON.stringify(filas)}.`);
  const [suma, dto, base, iva, total] = filas.map(cifra);
  assert.equal(suma, 1000, `🔴 «Suma de líneas» no es 1.000,00: ${JSON.stringify(filas)}.`);
  assert.equal(dto, -100, `🔴 «Descuento global» no es −100,00: ${JSON.stringify(filas)}.`);
  assert.equal(Math.round((suma + dto) * 100), Math.round(base * 100), `🔴 suma − descuento ≠ base: ${JSON.stringify(filas)}.`);
  assert.equal(Math.round((base + iva) * 100), Math.round(total * 100), `🔴 base + IVA ≠ total: ${JSON.stringify(filas)}.`);
  assert.equal(total, 967.5, `🔴 el total no es el guardado (967,50): ${JSON.stringify(filas)}.`);
});

test('SCRUM-1635 ② · CONTROL: sin ningún descuento, la ficha no gana ninguna fila', async () => {
  const filas = await filasDeTotales(ficha(213, [{ concept: 'Concepto 1635', qty: 10, price: 100, tax: 0.075 }], '1075.00', null));
  assert.deepEqual(filas.map((f) => f.split(':')[0].trim()), ['Base imponible', 'IVA', 'Total'],
    `🔴 sin descuento la ficha ha ganado filas: ${JSON.stringify(filas)}.`);
  // Un global a cero tampoco es un descuento: ni fila vacía ni «−0,00».
  const conCero = await filasDeTotales(ficha(214, [{ concept: 'Concepto 1635', qty: 10, price: 100, tax: 0.075 }], '1075.00', '0'));
  assert.deepEqual(conCero.map((f) => f.split(':')[0].trim()), ['Base imponible', 'IVA', 'Total'],
    `🔴 con un global a 0 la ficha ha ganado filas: ${JSON.stringify(conCero)}.`);
});

test('SCRUM-1635 ③ · CONTROL: con descuento SÓLO de línea, la ficha no gana ninguna fila', async () => {
  const filas = await filasDeTotales(ficha(215, [{ concept: 'Concepto 1635', qty: 10, price: 100, tax: 0.075, dto: 10 }], '967.50', null));
  assert.deepEqual(filas.map((f) => f.split(':')[0].trim()), ['Base imponible', 'IVA', 'Total'],
    `🔴 con descuento sólo de línea la ficha ha ganado filas: ${JSON.stringify(filas)}.`);
});
