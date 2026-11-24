// tests/scrum1800c-cancelar-cobro-con-factura-pagada.test.mjs — SCRUM-1800c (literal FIRMADO y decisión:
// SCRUM-1800 c.22496 ①; la ruta que contesta 409 `document_already_paid`: SCRUM-1800, PR #3350, J2)
//
// EL BOTÓN «Cancelar cobro» DE LA FICHA DE FACTURA (SCRUM-1532d) CON LA FACTURA YA PAGADA:
//   ① si `POST /admin/charges/:id/cancel` contesta 409 `document_already_paid`, la ficha pinta el
//     literal firmado, no el genérico «Error actualizando estado: inténtalo de nuevo»;
//   ② con la factura pagada (`status: 'paid'` o `paidAt`) el botón no se pinta, aunque el cobro siga
//     `pending`.
// Control: factura sin pagar con el cobro `pending` → botón visible, y el 409 `charge_not_pending`
// sigue con su texto de antes.
//
// CÓMO SE MIDE: la vista REAL de `public/` en el banco de vistas (`_banco-vistas.mjs`), con su
// registro de acciones; el clic y el `confirm` pasan por los oyentes de la vista. Datos de EJEMPLO.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Literales FIRMADOS: el botón en SCRUM-1532 c.22430; el aviso nuevo en SCRUM-1800 c.22496 ①.
const BOTON = 'Cancelar cobro';
const YA_PAGADO = 'Este documento ya consta como pagado: su cobro no se puede cancelar.';
const NO_PENDIENTE = 'Este cobro ya no está pendiente.';
const GENERICO = 'Error actualizando estado: inténtalo de nuevo';

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La ficha vuelve a ofrecer cancelar el cobro de una factura con `paidAt`.
    fichero: 'public/dashboard/js/invoiceDetailView.js',
    de: "if (invoice.chargeId && invoice.estadoDelCobro === 'pending' && !invoice.paidAt) {",
    a: "if (invoice.chargeId && invoice.estadoDelCobro === 'pending') {",
    cae: 'SCRUM-1800c · ② con la factura pagada (paidAt) y el cobro pendiente, no se pinta el botón',
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
  chargeId: 55, estadoDelCobro: 'pending',
});

async function ficha(cambios = {}, respuestaCancelar = null) {
  const factura = { ...BASE, ...cambios };
  const banco = cargarDashboard(RAIZ);
  banco.ctx.appModoEmision = 'fiscal';
  banco.ctx.confirm = () => true;
  banco.ctx.fetch = async (u) => {
    if (/\/admin\/charges\/\d+\/cancel$/.test(String(u))) return respuestaCancelar;
    return { ok: true, json: async () => (/\/admin\/invoices\/7$/.test(String(u)) ? factura : []) };
  };
  banco.ctx.apiRequest = async () => [];
  const r = await pintarVista(banco, 'renderInvoiceDetailView', 7);
  assert.equal(r.error, null, `🔴 la ficha revienta: ${r.error && r.error.message}`);
  const esBoton = (n) => String(n.tag || n.tagName || '').toLowerCase() === 'button';
  const disparador = todos(r.contenedor).find((n) => esBoton(n) && n.textContent === '⋯');
  if (disparador) await disparador.click();
  const vistos = () => [...new Set([...todos(r.contenedor), ...todos(banco.ctx.document.body)])];
  const botones = vistos().filter(esBoton);
  assert.ok(botones.length > 0, '🔴 CIEGO: la ficha no pinta ningún botón.');
  return { botones, cancelar: botones.filter((b) => b.textContent === BOTON), vistos };
}

async function pulsarYLeer(respuestaCancelar) {
  const { cancelar, vistos } = await ficha({}, respuestaCancelar);
  assert.equal(cancelar.length, 1, '🔴 CIEGO: no hay botón que pulsar.');
  await cancelar[0].click();
  await new Promise((ok) => setTimeout(ok, 20));
  return vistos().map((n) => n.textContent || '');
}

test('SCRUM-1800c · ① el 409 document_already_paid pinta el literal firmado', async () => {
  const textos = await pulsarYLeer({ ok: false, status: 409, json: async () => ({ error: 'document_already_paid', message: 'ZZCRUDO' }) });
  assert.ok(textos.some((t) => t === YA_PAGADO), `🔴 no se pinta «${YA_PAGADO}».`);
  assert.ok(!textos.some((t) => t === GENERICO), '🔴 se pinta el genérico.');
  assert.ok(!textos.some((t) => t.includes('ZZCRUDO')), '🔴 se pinta el `message` crudo del servidor (SCRUM-644).');
});

test('SCRUM-1800c · ① control: el 409 charge_not_pending sigue con su texto de antes', async () => {
  const textos = await pulsarYLeer({ ok: false, status: 409, json: async () => ({ error: 'charge_not_pending' }) });
  assert.ok(textos.some((t) => t === NO_PENDIENTE), `🔴 no se pinta «${NO_PENDIENTE}».`);
  assert.ok(!textos.some((t) => t === YA_PAGADO), '🔴 charge_not_pending pinta el literal de documento pagado.');
});

test('SCRUM-1800c · ② control: factura sin pagar con el cobro pendiente pinta el botón', async () => {
  const { cancelar, botones } = await ficha({});
  assert.equal(cancelar.length, 1, `🔴 no hay UN botón «${BOTON}»: ${botones.map((b) => b.textContent).join(' | ')}`);
});

test("SCRUM-1800c · ② con la factura en status 'paid' y el cobro pendiente, no se pinta el botón", async () => {
  const { cancelar } = await ficha({ status: 'paid', paidAt: '2026-11-20T10:00:00.000Z' });
  assert.equal(cancelar.length, 0, '🔴 con la factura pagada se pinta el botón.');
});

test('SCRUM-1800c · ② con la factura pagada (paidAt) y el cobro pendiente, no se pinta el botón', async () => {
  const { cancelar } = await ficha({ paidAt: '2026-11-20T10:00:00.000Z' });
  assert.equal(cancelar.length, 0, '🔴 con `paidAt` se pinta el botón.');
});
