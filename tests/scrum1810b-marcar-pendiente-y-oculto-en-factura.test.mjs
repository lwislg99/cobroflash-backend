// tests/scrum1810b-marcar-pendiente-y-oculto-en-factura.test.mjs — SCRUM-1810b (medición: SCRUM-1810
// c.22530, jv-j1jk; decisión A+B y literal FIRMADO: SCRUM-1810 c.22535)
//
// EL BOTÓN `btnTogglePaid` DE LA FICHA (`public/dashboard/js/invoiceDetailView.js`) CON EL DOCUMENTO
// PAGADO. Sobre un documento `paid` el clic manda `status: 'pending'` (deshacer el pago), y su rótulo
// era fijo, «Marcar como cobrada». El servidor solo admite deshacer el pago de un JUSTIFICANTE
// (`invoiceAdmin.ts`, `UnpayNotAllowedError`); en una factura lo rechaza siempre.
//   ① A · factura pagada → el botón no se pinta (ni con ese rótulo ni con el nuevo);
//   ② B · justificante pagado → el botón está y su rótulo es el literal firmado «Marcar como pendiente»;
//   ③ control · justificante pendiente → «Marcar como cobrada», como siempre.
//
// CÓMO SE MIDE: la vista REAL de `public/` en el banco de vistas (`_banco-vistas.mjs`), con su
// registro de acciones; se abre el «⋯» por su oyente. Datos de EJEMPLO.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Literales: «Marcar como cobrada» aprobado el 17-ago-2026 (scrum283-microcopy-marcador);
// «Marcar como pendiente» FIRMADO por el fundador en SCRUM-1810 c.22535.
const COBRADA = 'Marcar como cobrada';
const PENDIENTE = 'Marcar como pendiente';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La ficha vuelve a ofrecer el conmutador en una factura pagada, que el servidor rechaza siempre.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: "if (!(constaPagado && !isReceipt)) ubicarAccion(btnTogglePaid, 'btnTogglePaid');",
    a: "ubicarAccion(btnTogglePaid, 'btnTogglePaid');",
    cae: 'SCRUM-1810b · ① factura pagada: no se pinta el botón de cobrada ni el de pendiente',
  },
];

const BASE = Object.freeze({
  id: 7, number: 'F-2026-0007', status: 'pending', type: 'F1', total: 133.1, currency: 'EUR',
  createdAt: '2026-11-02T09:00:00.000Z',
  customerName: 'ZZCLIENTE Reformas Ejemplo', customerTaxId: 'B12345678',
  customerPhone: '+34600000000', customerEmail: 'cliente@ejemplo.test',
  customer: { id: 1, name: 'ZZCLIENTE ficha viva' },
  lines: [{ concept: 'ZZCONCEPTO alicatado', qty: 1, price: 100, tax: 0.21 }],
  rectifiedBy: [],
});
const PAGADO = Object.freeze({ status: 'paid', paidAt: '2026-11-20T10:00:00.000Z' });
const JUSTIFICANTE = Object.freeze({ type: 'JUST', number: 'J-2026-0007' });

async function botonesDeLaFicha(cambios = {}) {
  const doc = { ...BASE, ...cambios };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.fetch = async (u) => ({ ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? doc : []) });
  banco.ctx.apiRequest = async () => [];
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  const esBoton = (n) => String(n.tag || n.tagName || '').toLowerCase() === 'button';
  const disparador = todos(r.contenedor).find((n) => esBoton(n) && n.textContent === '⋯');
  if (disparador) await disparador.click();
  const vistos = [...new Set([...todos(r.contenedor), ...todos(banco.ctx.document.body)])];
  const botones = vistos.filter(esBoton);
  // Control positivo: «Descargar PDF» se pinta en todos estos estados; sin él, el banco no ve la ficha.
  assert.ok(botones.some((b) => b.textContent === 'Descargar PDF'), '🔴 CIEGO: la ficha no pinta «Descargar PDF».');
  const rotulos = botones.map((b) => b.textContent);
  return { rotulos, con: (t) => botones.filter((b) => b.textContent === t) };
}

test('SCRUM-1810b · ① factura pagada: no se pinta el botón de cobrada ni el de pendiente', async () => {
  const { con, rotulos } = await botonesDeLaFicha({ ...PAGADO });
  assert.equal(con(COBRADA).length, 0, `🔴 factura pagada con «${COBRADA}»: ${rotulos.join(' | ')}`);
  assert.equal(con(PENDIENTE).length, 0, `🔴 factura pagada con «${PENDIENTE}»: ${rotulos.join(' | ')}`);
});

test('SCRUM-1810b · ① factura con paidAt y otro estado: tampoco se pinta', async () => {
  const { con, rotulos } = await botonesDeLaFicha({ status: 'expired', paidAt: PAGADO.paidAt });
  assert.equal(con(COBRADA).length + con(PENDIENTE).length, 0, `🔴 se pinta el conmutador: ${rotulos.join(' | ')}`);
});

test('SCRUM-1810b · ② justificante pagado: el botón dice «Marcar como pendiente»', async () => {
  const { con, rotulos } = await botonesDeLaFicha({ ...JUSTIFICANTE, ...PAGADO });
  assert.equal(con(PENDIENTE).length, 1, `🔴 no hay UN «${PENDIENTE}»: ${rotulos.join(' | ')}`);
  assert.equal(con(COBRADA).length, 0, `🔴 sigue saliendo «${COBRADA}»: ${rotulos.join(' | ')}`);
});

test('SCRUM-1810b · ③ control: justificante pendiente sigue con «Marcar como cobrada»', async () => {
  const { con, rotulos } = await botonesDeLaFicha({ ...JUSTIFICANTE });
  assert.equal(con(COBRADA).length, 1, `🔴 no hay UN «${COBRADA}»: ${rotulos.join(' | ')}`);
  assert.equal(con(PENDIENTE).length, 0, `🔴 sale «${PENDIENTE}» en pendiente: ${rotulos.join(' | ')}`);
});

test('SCRUM-1810b · ③ control: factura pendiente sigue con «Marcar como cobrada»', async () => {
  const { con, rotulos } = await botonesDeLaFicha({});
  assert.equal(con(COBRADA).length, 1, `🔴 no hay UN «${COBRADA}»: ${rotulos.join(' | ')}`);
});
