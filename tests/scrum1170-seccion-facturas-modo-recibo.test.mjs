// tests/scrum1170-seccion-facturas-modo-recibo.test.mjs — SCRUM-1170
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EN MODO JUSTIFICANTE, LA FICHA NO ENSEÑA UNA SECCIÓN «FACTURAS» QUE NUNCA TENDRÁ CONTENIDO
//
// Desde SCRUM-1160 el botón «Generar factura» no se pinta en `receipt`, así que la sección
// «Facturas» se quedaba sólo con «No hay facturas generadas.» — hablando de un documento que el
// modo no deja emitir (regla 24). No se monta si no se puede facturar (fallando cerrado con el modo
// desconocido) y el presupuesto no tiene facturas; si YA las tiene, sale con ellas. Ficha MONTADA
// en el banco, en los dos sentidos.
// ═════════════════════════════════════════════════════════════════════════════════════════════

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Un presupuesto ACEPTADO y sin facturas (mismo fixture que SCRUM-1160 y SCRUM-1169). */
const presupuesto = (extra = {}) => ({
  id: 1, number: 1, quoteNumber: 1, revision: 0, numeroConRevision: 'P1', revisiones: [], vigenteId: 1,
  status: 'accepted', total: '100.00', currency: 'EUR', payToken: 'tok1',
  lines: [{ concept: 'Punto de luz', qty: 2, price: 50, tax: 0.21 }],
  createdAt: '2026-09-20T10:00:00.000Z', updatedAt: '2026-09-20T10:00:00.000Z',
  // Rango IMPOSIBLE (34 + 0 + 8 dígitos), como en SCRUM-984: ningún envío puede llegar a nadie.
  customer: { id: 3, name: 'Ana Ruiz', phone: '34000000001', email: null, notes: null },
  merchant: { id: 7, name: 'QA 1170', legalName: null, taxId: null, address: null, whatsappPhone: null, defaultCurrency: 'EUR', logoUrl: null },
  charge: null, invoices: [],
  decision: { acceptedAt: '2026-09-20T10:00:00.000Z', rejectedAt: null, decisionChannel: 'backoffice', decisionComment: null, rejectionReason: null, paymentTerms: 'FULL_UPFRONT', evidence: null },
  billingPlan: [], nextStage: null, hasCustomPlan: false,
  asignados: [], waDelivery: null, tags: null, internalNotes: null, signatureUrl: null, firmaConTrazo: false,
  albaranOrigen: { elegible: false, jobId: null, motivo: 'sin_trabajo' },
  ...extra,
});

const UNA_FACTURA = [{ id: 9, number: 'F-2026-0009', total: '121.00', currency: 'EUR', status: 'paid', createdAt: '2026-09-21T10:00:00.000Z' }];

/** Monta la ficha con el modo que el servidor habría dicho en `/admin/me`. */
async function montar(modo, quote = presupuesto()) {
  const banco = cargarDashboard(RAIZ, {
    datos: (url) => (/\/admin\/quotes\/1$/.test(String(url)) ? quote : []),
  });
  if (modo !== undefined) banco.ctx.appModoEmision = modo;
  banco.ctx.renderAppView = () => {};
  const r = await pintarVista(banco, 'renderQuoteDetailView', 1);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  const nodos = r.contenedor ? todos(r.contenedor) : [];
  assert.ok(nodos.length > 60, `🔴 CIEGO: la ficha montó ${nodos.length} nodos; no es la pantalla entera`);
  const titulos = nodos
    .filter((n) => String(n.className || '').split(/\s+/).includes('detail-section-title'))
    .map((n) => String(n.textContent || '').trim());
  const texto = nodos.map((n) => String(n.textContent || '')).join(' | ');
  return { titulos, texto };
}

for (const modo of ['fiscal', 'demo']) {
  test(`SCRUM-1170 · en modo \`${modo}\` la sección «Facturas» está, con su vacío (control positivo)`, async () => {
    const m = await montar(modo);
    assert.ok(m.titulos.includes('Facturas'), `🔴 falta la sección «Facturas» (secciones: ${m.titulos.join(', ')})`);
    assert.match(m.texto, /No hay facturas generadas\./);
  });
}

for (const [nombre, modo] of [['receipt', 'receipt'], ['desconocido (null)', null], ['sin dato (undefined)', undefined]]) {
  test(`SCRUM-1170 · 🔴 en modo ${nombre} y sin facturas, NO hay sección «Facturas»`, async () => {
    const m = await montar(modo);
    // Suelo: la ficha pintó sus otras secciones; si no, «no está» sería ceguera.
    assert.ok(m.titulos.includes('Conceptos'), `🔴 CIEGO: la ficha no pintó sus secciones (vistas: ${m.titulos.join(', ') || 'ninguna'})`);
    assert.ok(!m.titulos.includes('Facturas'), '🔴 en modo justificante la ficha enseña una sección «Facturas» que no tendrá contenido.');
    assert.doesNotMatch(m.texto, /No hay facturas generadas/);
  });
}

test('SCRUM-1170 · en `receipt` con una factura YA existente, la sección sale con ella', async () => {
  const m = await montar('receipt', presupuesto({ invoices: UNA_FACTURA }));
  assert.ok(m.titulos.includes('Facturas'), '🔴 una factura que ya existe tiene que verse.');
  assert.match(m.texto, /F-2026-0009/);
});
