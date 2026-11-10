// tests/scrum1250b-pay-unpay-desmontadas.test.mjs — SCRUM-1250b (J1, 24-oct-2026)
//
// `POST /admin/invoices/:id/pay` y `/unpay` eran envoltorios legacy de `updateInvoiceStatusAdmin` que
// ninguna pantalla llamaba (medido en SCRUM-1250 c.20742). El fundador firmó desmontarlas
// (SCRUM-1250 c.20747): el camino bueno, `PUT /:id/status`, no cambia.
//
// Se mide por HTTP contra la app REAL (`dist/app.js`, con `requireAuth` y `requireRole`), con la
// sesión del PROPIETARIO: si la ruta siguiera montada, el propietario llegaría a su handler.
//
// 🔴 EL POSITIVO SE SIEMBRA: una ruta que no ha existido nunca (`/no-existe-1250b`) es la referencia
// de «no montada». `pay` y `unpay` tienen que contestar EXACTAMENTE lo mismo que ella (estado y
// cuerpo). Y el CONTROL de que el banco llega a los handlers: `PUT /:id/status` sigue contestando
// sus 400 propios (`invalid_id`, `invalid_status`), que sólo escribe su handler.
//
// Mutación (registro de SCRUM-1250b): volver a montar `/:id/pay` en `dist/` tumba el primer caso.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bancoDePrisma, montarAppReal, sesionesDe } from './_banco-camino-real.mjs';

const MERCHANT = 1250;
const TECNICO = { id: 12502, name: 'Técnico 1250b', role: 'tecnico', active: true, merchantId: MERCHANT };

async function app() {
  const ses = sesionesDe(MERCHANT, TECNICO);
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async () => ses.merchant },
    teamMember: { findFirst: async () => null },
    invoice: { findFirst: async () => null, findUnique: async () => null, findMany: async () => [] },
  });
  return { app: await montarAppReal(), token: ses.PROPIETARIO };
}

const REFERENCIA = '/admin/invoices/7/no-existe-1250b';

test('SCRUM-1250b · 🔴 POST /admin/invoices/:id/pay y /unpay contestan lo mismo que una ruta que no existe', async () => {
  const { app: a, token } = await app();
  const ref = await a.pedir(REFERENCIA, { token, metodo: 'POST', cuerpo: {} });
  assert.equal(ref.status, 404, `🔴 CIEGO: la referencia sembrada no da 404 (${ref.status}); el banco no distingue «no montada»`);
  for (const ruta of ['/admin/invoices/7/pay', '/admin/invoices/7/unpay']) {
    const r = await a.pedir(ruta, { token, metodo: 'POST', cuerpo: {} });
    assert.equal(r.status, 404, `🔴 POST ${ruta} contesta ${r.status}: la ruta sigue montada (SCRUM-1250 c.20747 la desmontó)`);
    assert.equal(r.texto.replace(ruta, REFERENCIA), ref.texto,
      `🔴 POST ${ruta} da 404 pero no el de «no montada»: lo contesta un handler, no el final de la cadena`);
  }
});

test('SCRUM-1250b · CONTROL: PUT /admin/invoices/:id/status sigue montada y llega a su handler', async () => {
  const { app: a, token } = await app();
  const sinId = await a.pedir('/admin/invoices/abc/status', { token, metodo: 'PUT', cuerpo: { status: 'paid' } });
  assert.equal(sinId.status, 400);
  assert.equal(sinId.json?.error, 'invalid_id', `🔴 PUT /status no llega a su handler: ${sinId.texto}`);
  const malEstado = await a.pedir('/admin/invoices/7/status', { token, metodo: 'PUT', cuerpo: { status: 'nope' } });
  assert.equal(malEstado.status, 400);
  assert.equal(malEstado.json?.error, 'invalid_status', `🔴 PUT /status no valida el estado: ${malEstado.texto}`);
});
