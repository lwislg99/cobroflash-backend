// tests/scrum1169-linea-tiempo-modo-recibo.test.mjs — SCRUM-1169
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EN MODO JUSTIFICANTE, LA LÍNEA DE TIEMPO NO PROMETE «FACTURADA · COBRADA»
//
// `buildStatusTimeline` (quotesDetailView.js) pintaba siempre cinco pasos. Para un merchant ES real
// (`receipt`, regla 24: ni documento ni cobro por YaQu) los dos últimos se quedaban en «pendiente»
// para siempre. Se ocultan con la misma comprobación que el resto de la casa
// (`facturaFiscalDisponible`, `fiscal`/`demo`), fallando cerrado con el modo desconocido. Y un
// presupuesto que YA tiene facturas los sigue enseñando: se oculta lo que no va a ocurrir, no lo
// que ya ocurrió. Ficha MONTADA en el banco, en los dos sentidos.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';
import { casosEscritos } from './_casos-escritos.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Un presupuesto ACEPTADO y sin facturas (mismo fixture que SCRUM-1160). */
const presupuesto = (extra = {}) => ({
  id: 1, number: 1, quoteNumber: 1, revision: 0, numeroConRevision: 'P1', revisiones: [], vigenteId: 1,
  status: 'accepted', total: '100.00', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  // Rango IMPOSIBLE (34 + 0 + 8 dígitos), como en SCRUM-984: ningún envío puede llegar a nadie.
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1169', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: '2026-09-20T10:00:00.000Z', rejectedAt: null, decisionChannel: 'backoffice', decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
  ...extra,
});

const PASOS = ['Creada', 'Enviada', 'Aceptada', 'Facturada', 'Cobrada'];

/** Monta la ficha con el modo que el servidor habría dicho en `/admin/me` y cuenta los pasos. */
async function pasosDeLaLinea(modo, quote = presupuesto()) {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/quotes\/1$/.test(String(url)) ? quote : []),
  });
  if (modo !== undefined) banco.ctx.appModoEmision = modo;
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, 'renderQuoteDetailView', 1);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  const nodos = r.contenedor ? todos(r.contenedor) : [];
  assert.ok(nodos.length > 60, `🔴 CIEGO: la ficha montó ${nodos.length} nodos; no es la pantalla entera`);
  // Un paso = un nodo HOJA cuyo texto es exactamente su rótulo.
  const hojas = nodos.filter((n) => n.hijos && n.hijos.filter((h) => h.tagName !== '#TEXT').length === 0);
  return PASOS.filter((p) => hojas.some((n) => String(n.textContent || '').trim() === p));
}

const FILAS_1 = ['fiscal', 'demo'];
const caso1 = casosEscritos(FILAS_1, (modo) => `SCRUM-1169 · en modo \`${modo}\` la línea tiene los 5 pasos (control positivo)`, async (modo) => {
  assert.deepEqual(await pasosDeLaLinea(modo), PASOS);
});
test('SCRUM-1169 · en modo `fiscal` la línea tiene los 5 pasos (control positivo)', caso1(0));
test('SCRUM-1169 · en modo `demo` la línea tiene los 5 pasos (control positivo)', caso1(1));
caso1.todos();

const FILAS_2 = [['receipt', 'receipt'], ['desconocido (null)', null], ['sin dato (undefined)', undefined]];
const caso2 = casosEscritos(FILAS_2, ([nombre, modo]) => `SCRUM-1169 · 🔴 en modo ${nombre} y sin facturas, NO hay «Facturada» ni «Cobrada»`, async ([nombre, modo]) => {
  const pasos = await pasosDeLaLinea(modo);
  assert.ok(pasos.includes('Creada') && pasos.includes('Aceptada'),
    `🔴 CIEGO: la línea de tiempo no se pintó (pasos vistos: ${pasos.join(', ') || 'ninguno'}).`);
  assert.deepEqual(pasos, ['Creada', 'Enviada', 'Aceptada'],
    '🔴 en modo justificante la línea promete pasos que la regla 24 no deja ocurrir.');
});
test('SCRUM-1169 · 🔴 en modo receipt y sin facturas, NO hay «Facturada» ni «Cobrada»', caso2(0));
test('SCRUM-1169 · 🔴 en modo desconocido (null) y sin facturas, NO hay «Facturada» ni «Cobrada»', caso2(1));
test('SCRUM-1169 · 🔴 en modo sin dato (undefined) y sin facturas, NO hay «Facturada» ni «Cobrada»', caso2(2));
caso2.todos();

test('SCRUM-1169 · en `receipt` con una factura YA existente, los 5 pasos siguen (lo que ya ocurrió se enseña)', async () => {
  const q = presupuesto({ invoices: [{ id: 9, status: 'paid', createdAt: '2026-09-21T10:00:00.000Z', paidAt: '2026-09-22T10:00:00.000Z' }] });
  assert.deepEqual(await pasosDeLaLinea('receipt', q), PASOS);
});
