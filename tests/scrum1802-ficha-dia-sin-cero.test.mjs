// tests/scrum1802-ficha-dia-sin-cero.test.mjs — SCRUM-1802
//
// EN LA FICHA DE LA FACTURA EL DÍA SALE SIN CERO A LA IZQUIERDA: «5 dic 2026», no «05 dic 2026».
// Decisión del fundador: SCRUM-1787 c.22491 («1-Sí»), citada en la descripción de SCRUM-1802. El PDF
// (1787x) y la página de pago (1787y) ya lo escribían así; la ficha llevaba `day: '2-digit'` en sus tres
// fechas: la fila «Vence el» (`dueDate`), la fecha del bloque de cobro (`paidAt`) y la fecha corta de los
// pasos (Emitida / Cobrada). Ningún texto nuevo: sólo cambia cómo se escribe el día.
//
// QUÉ MIRA: la ficha MONTADA en el banco de vistas (`renderInvoiceDetailView`), no el código fuente.
// Control: un día de dos cifras (10) sigue saliendo con sus dos cifras. Las fechas van a mediodía UTC,
// para que ninguna zona horaria de la máquina las mueva de día.
// QUÉ NO MIRA: otras pantallas (`quotesDetailView.js`, `jobDetailView.js`…), que no están en la decisión.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La fila «Vence el» vuelve a escribir el día con dos cifras.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: "new Date(invoice.dueDate).toLocaleDateString('es-ES', { day: 'numeric'",
    a: "new Date(invoice.dueDate).toLocaleDateString('es-ES', { day: '2-digit'",
    cae: 'SCRUM-1802 · ① «Vence el» escribe el día sin cero',
  },
];

const FACTURA = Object.freeze({
  id: 7, number: 'F-2026-0007', status: 'pending', type: 'F1', total: 133.1, currency: 'EUR',
  createdAt: '2026-11-02T12:00:00.000Z', customerName: 'Cliente Ejemplo', customer: { id: 1, name: 'Cliente Ejemplo' },
  lines: [{ concept: 'ZZCONCEPTO alicatado', qty: 1, price: 110, tax: 0.21 }],
  rectifiedBy: [],
});

async function fichaDe(cambios) {
  const factura = { ...FACTURA, ...cambios };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.fetch = async (u) => ({ ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? factura : []) });
  banco.ctx.apiRequest = async () => [];
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha revienta al abrirse: ${r.error && r.error.message}`);
  const nodos = todos(r.contenedor);
  const texto = (n) => (n.textContent || '').trim();
  const rotulos = nodos.filter((n) => n.tagName === 'DT').map(texto);
  const valorDe = (rotulo) => {
    const i = nodos.findIndex((n) => n.tagName === 'DT' && texto(n) === rotulo);
    const dd = i < 0 ? null : nodos.slice(i + 1).find((n) => n.tagName === 'DD');
    return dd ? texto(dd) : null;
  };
  const deClase = (clase) => nodos.filter((n) => String(n.className || '').split(/\s+/).includes(clase)).map(texto);
  return { rotulos, valorDe, deClase };
}

test('SCRUM-1802 · ① «Vence el» escribe el día sin cero', async () => {
  const f = await fichaDe({ dueDate: '2026-12-05T12:00:00.000Z' });
  // Suelo: si el banco no pinta la ficha, «no lleva 05» pasaría sobre la nada.
  assert.ok(f.rotulos.includes('Cliente'), `CIEGO: la ficha no pinta ni «Cliente» (rótulos: ${f.rotulos.join(' | ')})`);
  assert.equal(f.valorDe('Vence el'), '5 dic 2026', '🔴 el día del vencimiento sale con cero a la izquierda (c.22491)');
});

test('SCRUM-1802 · ② control: un día de dos cifras sigue con sus dos cifras', async () => {
  const f = await fichaDe({ dueDate: '2026-12-10T12:00:00.000Z' });
  assert.equal(f.valorDe('Vence el'), '10 dic 2026');
});

test('SCRUM-1802 · ③ la fecha del cobro y las de los pasos escriben el día sin cero', async () => {
  const f = await fichaDe({
    status: 'paid', chargeId: 'ch_ejemplo', createdAt: '2026-12-05T12:00:00.000Z', paidAt: '2026-12-06T12:00:00.000Z',
  });
  assert.deepEqual(f.deClase('detail-cobro-fecha'), ['6 dic 2026'], '🔴 la fecha del bloque de cobro sale con cero');
  // Emitida (createdAt) y Cobrada (paidAt): «Enviada» no lleva fecha.
  assert.deepEqual(f.deClase('j1-prog-fecha'), ['5 dic', '6 dic'], '🔴 la fecha corta de los pasos sale con cero');
  // Control en la misma pantalla: el día de dos cifras no pierde ninguna.
  const g = await fichaDe({
    status: 'paid', chargeId: 'ch_ejemplo', createdAt: '2026-12-10T12:00:00.000Z', paidAt: '2026-12-11T12:00:00.000Z',
  });
  assert.deepEqual(g.deClase('detail-cobro-fecha'), ['11 dic 2026']);
  assert.deepEqual(g.deClase('j1-prog-fecha'), ['10 dic', '11 dic']);
});
