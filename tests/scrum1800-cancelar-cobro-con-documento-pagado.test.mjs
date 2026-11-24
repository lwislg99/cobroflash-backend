// tests/scrum1800-cancelar-cobro-con-documento-pagado.test.mjs — SCRUM-1800 (J2, 24-nov-2026)
//
// CANCELAR UN COBRO CUYO DOCUMENTO YA CONSTA PAGADO SE NIEGA.
//
// Hallazgo de staging (SCRUM-1532 c.22487): `POST /admin/charges/889/cancel` contestó 200 y dejó
// el recibo «cancelado» con su justificante en `paid`. La ruta sólo leía `charge.status`. Medido
// el 24-nov en staging: 3 de los 8 cobros `pending` tienen su documento en `paid` (los tres
// justificantes `J-` marcados a mano, `marcar_pagado_manual`): el marcado manual de una factura
// no cierra su cobro. El detalle, en `docs/master/SCRUM-1800.md`.
//
// 🔴 POR LA RUTA MONTADA, NO POR EL HANDLER (A10, SCRUM-1344). Arranca `dist/app.js` entero con el
// banco de SCRUM-597 y pide `POST /admin/charges/:id/cancel` con la cookie del propietario: pasa
// por `requireAuth`, el `requireRole('admin')` del montaje y el de la ruta.
//
// EL DOCUMENTO DEL COBRO, con el criterio de `facturaDelCobro` y de `/webhooks/psp`: la factura
// (o el justificante) con `chargeId` del cobro, o la del presupuesto ligado al cobro. Las dos
// llegadas tienen su caso. El doble RESPETA el `select` anidado y su `where`: un doble que
// devolviera los documentos sin filtrar daría el rojo a una ruta que no los pidió pagados.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

/** Mutaciones que este fichero tiene que tumbar (A3, SCRUM-1731). */
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    fichero: 'src/modules/billing/app/routes/chargesAdmin.routes.ts',
    de: "if (documentoDelCobroPagado(charge)) return res.status(409).json({ error: 'document_already_paid' });",
    a: '',
    cae: 'su factura (por `chargeId`) ya consta pagada',
  },
];

const app = await montarAppReal();
after(() => app.cerrar());

const MIO = 1800;
const OTRO = 1801;
const ses = sesionesDe(MIO, { id: 9, role: 'tecnico', merchantId: MIO });
const ID = 889;

/** ¿La fila cumple el `where` (sólo igualdades: lo que usa la ruta)? */
function cumple(fila, where) {
  return Object.entries(where || {}).every(([k, v]) => fila[k] === v);
}

/** Resuelve un `select` de Prisma sobre una fila, con relaciones anidadas filtradas por su `where`. */
function proyectar(fila, select) {
  const out = {};
  for (const [k, v] of Object.entries(select || {})) {
    if (!v || !(k in fila)) continue;
    if (v === true) { out[k] = fila[k]; continue; }
    const hijos = fila[k].filter((h) => cumple(h, v.where));
    out[k] = (v.take ? hijos.slice(0, v.take) : hijos).map((h) => proyectar(h, v.select));
  }
  return out;
}

/** Un cobro de MIO con sus documentos por las dos llegadas. */
function programar({ estado = 'pending', porCargo = [], porPresupuesto = [] } = {}) {
  const cobro = {
    id: ID, merchantId: MIO, status: estado,
    invoices: porCargo.map((d, i) => ({ id: 100 + i, merchantId: MIO, ...d })),
    Quote: [{ id: 50, merchantId: MIO, Invoice: porPresupuesto.map((d, i) => ({ id: 200 + i, merchantId: MIO, ...d })) }],
  };
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => ({ ...ses.merchant, country: 'ES', flags: null }) },
    charge: {
      findFirst: async (a) => (cumple(cobro, a?.where) ? proyectar(cobro, a?.select) : null),
      update: async (a) => ({ id: ID, status: a?.data?.status }),
    },
  });
}

const cancelar = () => app.pedir(`/admin/charges/${ID}/cancel`, { token: ses.PROPIETARIO, metodo: 'POST' });
const escrituras = () => bancoDePrisma().escrituras.map((e) => `${e.modelo}.${e.op}`);

test('SCRUM-1800 · control: pending con su documento SIN pagar → cancela (200) y escribe el cobro una vez', async () => {
  programar({ porCargo: [{ status: 'pending' }], porPresupuesto: [{ status: 'pending' }] });
  const r = await cancelar();
  assert.equal(r.status, 200, `suelo: ${r.status} ${String(r.texto).slice(0, 200)}`);
  assert.equal(r.json?.status, 'cancelled');
  assert.deepEqual(escrituras(), ['charge.update']);
});

test('SCRUM-1800 · pending y su factura (por `chargeId`) ya consta pagada → 409 `document_already_paid` y no escribe nada', async () => {
  programar({ porCargo: [{ status: 'paid' }] });
  const r = await cancelar();
  assert.equal(r.status, 409, `se canceló un cobro con su documento pagado: ${r.status} ${String(r.texto).slice(0, 200)}`);
  assert.equal(r.json?.error, 'document_already_paid');
  assert.deepEqual(escrituras(), []);
});

test('SCRUM-1800 · pending y la factura de su presupuesto ya consta pagada → 409 `document_already_paid` y no escribe nada', async () => {
  programar({ porPresupuesto: [{ status: 'paid' }] });
  const r = await cancelar();
  assert.equal(r.status, 409, `se canceló un cobro con su documento pagado: ${r.status} ${String(r.texto).slice(0, 200)}`);
  assert.equal(r.json?.error, 'document_already_paid');
  assert.deepEqual(escrituras(), []);
});

test('SCRUM-1800 · regla 2: un documento pagado de OTRO comercio colgado del cobro no lo bloquea', async () => {
  programar({ porCargo: [{ status: 'paid', merchantId: OTRO }], porPresupuesto: [{ status: 'paid', merchantId: OTRO }] });
  const r = await cancelar();
  assert.equal(r.status, 200, `${r.status} ${String(r.texto).slice(0, 200)}`);
  assert.deepEqual(escrituras(), ['charge.update']);
});

test('SCRUM-1800 · el orden se conserva: un cobro ya cancelado sigue siendo idempotente y uno pagado sigue en `charge_not_pending`', async () => {
  programar({ estado: 'cancelled', porCargo: [{ status: 'paid' }] });
  const ya = await cancelar();
  assert.equal(ya.status, 200);
  assert.equal(ya.json?.yaEstaba, true);
  programar({ estado: 'paid', porCargo: [{ status: 'paid' }] });
  const pagado = await cancelar();
  assert.equal(pagado.status, 409);
  assert.equal(pagado.json?.error, 'charge_not_pending');
  assert.deepEqual(escrituras(), []);
});
