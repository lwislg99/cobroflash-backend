// tests/scrum1803-pago-manual-cierra-el-cobro.test.mjs — SCRUM-1803 (J1, 24-nov-2026)
//
// MARCAR PAGADA A MANO UNA FACTURA CIERRA SU COBRO PENDIENTE (decisión del fundador SCRUM-1800
// c.22496 ③; plan de jv-j1jd en SCRUM-1803 c.22499).
//
// Causa raíz de SCRUM-1800: en staging, 3 de los 8 cobros `pending` tenían su documento en `paid`,
// los tres marcados a mano. Ahora, en las dos puertas a mano (`PUT /admin/invoices/:id/status` y
// `POST /admin/invoices/bulk-paid`), el cobro enlazado por `Invoice.chargeId` pasa a `paid` con la
// MISMA fecha que la factura y su evento `paid` (`datosDeCobroPagado`, la función de la casa).
//
// 🔴 POR LA RUTA MONTADA, NO POR EL HANDLER (A10, SCRUM-1344): `dist/app.js` entero con el banco de
// SCRUM-597. El doble de `charge.update` HACE CUMPLIR el `where` como Prisma: si la fila no casa,
// lanza P2025 y no cambia nada. Así «el cobro ya pagado/cancelado queda intacto» se mide sobre la
// fila, no sobre la intención: sin `status: 'pending'` en el `where`, la fila cambia y el caso cae.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

/** Mutaciones que este fichero tiene que tumbar (A3, SCRUM-1731). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/system/invoiceAdmin.ts',
    de: "where: { id: chargeId, merchantId, status: 'pending' },",
    a: 'where: { id: chargeId, merchantId },',
    cae: 'un cobro ya `paid` queda intacto',
  },
];

const app = await montarAppReal();
after(() => app.cerrar());

const MIO = 1803;
const ses = sesionesDe(MIO, { id: 9, role: 'tecnico', merchantId: MIO });
const FACTURA = 70;
const COBRO = 889;
const ANTES = new Date('2026-11-01T10:00:00.000Z');

function cumple(fila, where) {
  return Object.entries(where || {}).every(([k, v]) => fila[k] === v);
}

/** Programa una factura `pending` y (si `cobro`) su cobro enlazado; devuelve la fila del cobro, viva. */
function programar({ chargeId = COBRO, cobro = { status: 'pending', method: 'bizum', paidAt: null } } = {}) {
  const fila = cobro ? { id: COBRO, merchantId: MIO, ...cobro } : null;
  const factura = {
    id: FACTURA, merchantId: MIO, status: 'pending', paidAt: null, type: 'FACT', number: 'F-2026-0001',
    lines: [], total: 121, chargeId,
  };
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => ({ ...ses.merchant, country: 'ES', flags: null, timezone: 'Europe/Madrid' }) },
    invoice: {
      findFirst: async (a) => (cumple(factura, a?.where) ? { ...factura } : null),
      update: async (a) => Object.assign(factura, a?.data),
      // `aMarcar` (sin chargeId en el select) y `marcadas` (con él): las dos, la misma factura.
      findMany: async (a) => (a?.select?.chargeId ? [{ id: FACTURA, total: 121, chargeId }] : [{ id: FACTURA, lines: [] }]),
      updateMany: async () => ({ count: 1 }),
    },
    charge: {
      update: async (a) => {
        if (!fila || !cumple(fila, a?.where)) throw Object.assign(new Error('no casa'), { code: 'P2025' });
        const { events, ...resto } = a.data;
        Object.assign(fila, resto, { evento: events?.create });
        return { ...fila };
      },
    },
  });
  return fila;
}

const escriturasDeCobro = () => bancoDePrisma().escrituras.filter((e) => e.modelo === 'charge');
const marcarUna = (cuerpo) => app.pedir(`/admin/invoices/${FACTURA}/status`, { token: ses.PROPIETARIO, metodo: 'PUT', cuerpo });
const marcarLote = (cuerpo) => app.pedir('/admin/invoices/bulk-paid', { token: ses.PROPIETARIO, metodo: 'POST', cuerpo });

test('SCRUM-1803 · PUT status paid con medio y fecha → el cobro pending pasa a paid, misma fecha, method declarado y evento paid', async () => {
  const cobro = programar();
  const r = await marcarUna({ status: 'paid', paidVia: 'transfer', paidAt: '2026-11-20' });
  assert.equal(r.status, 200, `suelo: ${r.status} ${String(r.texto).slice(0, 200)}`);
  const fechaFactura = new Date(r.json?.paidAt).getTime();
  assert.ok(Number.isFinite(fechaFactura), 'la factura no devolvió paidAt');
  assert.equal(cobro.status, 'paid', 'el cobro sigue pending tras marcar pagada la factura');
  assert.equal(new Date(cobro.paidAt).getTime(), fechaFactura, 'el cobro no lleva la fecha del pago manual');
  assert.equal(cobro.method, 'transfer');
  assert.equal(cobro.evento?.type, 'paid');
  assert.equal(new Date(cobro.evento?.ts).getTime(), fechaFactura);
  assert.equal(escriturasDeCobro().length, 1);
});

test('SCRUM-1803 · PUT status paid SIN medio → el cobro se cierra y su method no se toca', async () => {
  const cobro = programar();
  const r = await marcarUna({ status: 'paid' });
  assert.equal(r.status, 200, `${r.status} ${String(r.texto).slice(0, 200)}`);
  assert.equal(cobro.status, 'paid');
  assert.equal(cobro.method, 'bizum');
  assert.equal('method' in escriturasDeCobro()[0].args.data, false, 'sin medio declarado se escribió method');
});

test('SCRUM-1803 · bulk-paid → el cobro pending pasa a paid con la fecha del lote y su method intacto', async () => {
  const cobro = programar();
  const r = await marcarLote({ ids: [FACTURA], paidAt: '2026-11-20' });
  assert.equal(r.status, 200, `${r.status} ${String(r.texto).slice(0, 200)}`);
  assert.equal(cobro.status, 'paid', 'el lote no cerró el cobro');
  assert.ok(cobro.paidAt instanceof Date && Number.isFinite(cobro.paidAt.getTime()));
  assert.equal(cobro.evento?.type, 'paid');
  assert.equal(cobro.method, 'bizum');
  assert.equal('method' in escriturasDeCobro()[0].args.data, false);
});

test('SCRUM-1803 · control: factura sin chargeId → ningún cobro se escribe (PUT y lote)', async () => {
  programar({ chargeId: null, cobro: null });
  const r1 = await marcarUna({ status: 'paid', paidVia: 'transfer' });
  assert.equal(r1.status, 200, `${r1.status} ${String(r1.texto).slice(0, 200)}`);
  assert.deepEqual(escriturasDeCobro(), []);
  programar({ chargeId: null, cobro: null });
  const r2 = await marcarLote({ ids: [FACTURA] });
  assert.equal(r2.status, 200);
  assert.deepEqual(escriturasDeCobro(), []);
});

/** Por las dos puertas, el cobro en `estado` no cambia: ni estado, ni fecha, ni método, ni evento. */
async function quedaIntacto(estado) {
  for (const marcar of [() => marcarUna({ status: 'paid', paidVia: 'transfer' }), () => marcarLote({ ids: [FACTURA] })]) {
    const cobro = programar({ cobro: { status: estado, method: 'card', paidAt: estado === 'paid' ? ANTES : null } });
    const r = await marcar();
    assert.equal(r.status, 200, `la factura no se marcó por un cobro que no casa: ${r.status} ${String(r.texto).slice(0, 200)}`);
    assert.equal(cobro.status, estado);
    assert.equal(cobro.method, 'card');
    assert.equal(cobro.paidAt, estado === 'paid' ? ANTES : null);
    assert.equal(cobro.evento, undefined);
  }
}

test('SCRUM-1803 · un cobro ya `paid` queda intacto (PUT y lote): ni estado, ni fecha, ni método', async () => {
  await quedaIntacto('paid');
});

test('SCRUM-1803 · un cobro ya `cancelled` queda intacto (PUT y lote): ni estado, ni fecha, ni método', async () => {
  await quedaIntacto('cancelled');
});
