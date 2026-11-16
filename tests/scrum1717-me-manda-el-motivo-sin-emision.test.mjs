// tests/scrum1717-me-manda-el-motivo-sin-emision.test.mjs — SCRUM-1717 (mitad S1)
//
// Con `INVOICING_ES_ENABLED` puesto y el SII en «Sí» o «No consta», el modo de emisión deja al
// profesional en `receipt` (SCRUM-1585). El panel esconde Facturas y Cobros y no le dice por qué:
// `/admin/me` no mandaba el motivo, así que el navegador no podía distinguir «flag apagado» de «el
// SII no te deja». Ahora viaja `motivoSinEmision`, YA RESUELTO por el servidor con la MISMA función
// que usa el modo (`motivoSiiSinEmision`): `sii_declarado` · `sii_no_consta` · `null` (nada).
// Los dos literales del aviso los pinta S2 (firmados en SCRUM-1585 c.20539); aquí no hay texto.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// La app REAL (`_banco-camino-real.mjs`) por HTTP, como scrum809b. El doble de `merchant.findUnique`
// HONRA EL `select`: si `/me` no pidiera `llevaLibrosPorSii`, el motivo saldría de un campo ausente
// (= «No consta») y el caso «No» lo cazaría.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

const app = await montarAppReal();
after(() => app.cerrar());
const ses = sesionesDe(1717, { id: 17, role: 'tecnico', merchantId: 1717 });

/** Lo que Prisma devolvería: sólo lo que el `select` pide. */
const proyectar = (fila, select) => (select
  ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, fila[k] === undefined ? null : fila[k]]))
  : fila);

async function meCon({ country = 'ES', flags, llevaLibrosPorSii }) {
  const fila = { ...ses.merchant, country, email: 'qa1717@test.local', flags, llevaLibrosPorSii };
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async (a) => proyectar(fila, a?.select) },
  });
  const r = await app.pedir('/admin/me', { token: ses.PROPIETARIO });
  assert.equal(r.status, 200, `suelo: /admin/me no respondió 200 (${r.status} ${r.texto?.slice(0, 200)})`);
  assert.ok(Object.hasOwn(r.json, 'motivoSinEmision'), '🔴 /admin/me no manda `motivoSinEmision`: el navegador no puede decir por qué no factura');
  return r.json;
}

const ON = { INVOICING_ES_ENABLED: true };

test('SCRUM-1717 · suelo: el merchant del banco no es el demo (si lo fuera, el motivo sería null siempre)', () => {
  assert.notEqual(ses.merchant.id, 1);
  assert.notEqual(ses.merchant.email, 'demo@yaqu.app');
});

test('SCRUM-1717 · 🔴 flag puesto y SII «Sí» → sii_declarado (y el modo, receipt)', async () => {
  const me = await meCon({ flags: ON, llevaLibrosPorSii: true });
  assert.equal(me.motivoSinEmision, 'sii_declarado');
  assert.equal(me.modoEmision, 'receipt', 'suelo: el motivo y el modo salen del mismo objeto');
});

test('SCRUM-1717 · 🔴 flag puesto y SII «No consta» → sii_no_consta', async () => {
  const me = await meCon({ flags: ON, llevaLibrosPorSii: null });
  assert.equal(me.motivoSinEmision, 'sii_no_consta');
  assert.equal(me.modoEmision, 'receipt');
});

test('SCRUM-1717 · control: flag puesto y SII «No» → nada (emite; el modo es fiscal)', async () => {
  const me = await meCon({ flags: ON, llevaLibrosPorSii: false });
  assert.equal(me.motivoSinEmision, null);
  assert.equal(me.modoEmision, 'fiscal', 'control: con el SII en «No» el modo tiene que ser fiscal, o el caso no mide nada');
});

test('SCRUM-1717 · control: flag apagado → nada, conteste lo que conteste el SII', async () => {
  for (const sii of [true, null, false]) {
    const me = await meCon({ flags: null, llevaLibrosPorSii: sii });
    assert.equal(me.motivoSinEmision, null, `flag apagado y SII ${sii}: el motivo debería ser null`);
  }
});

test('SCRUM-1717 · control: fuera de España → nada (el flag es ES-only)', async () => {
  const me = await meCon({ country: 'PT', flags: ON, llevaLibrosPorSii: true });
  assert.equal(me.motivoSinEmision, null);
});
