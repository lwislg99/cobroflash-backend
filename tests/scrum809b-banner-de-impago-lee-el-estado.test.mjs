// tests/scrum809b-banner-de-impago-lee-el-estado.test.mjs — SCRUM-809b
//
// 🔴 EL BANNER DE IMPAGO NO PODÍA SALIR NUNCA.
//
// `app.js` pinta el banner cuando `GET /admin/me` dice `subscriptionStatus: 'past_due'`. La ruta lo
// leía de `session.merchant`, y `getSession` (auth.service.ts) no selecciona ese campo: para todo
// merchant que no sea el dueño de la plataforma valía `null`, fuera cual fuera su estado. Medido en
// yaqu.app el 18-oct-2026 con la cuenta QA: `subscriptionStatus: null`.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// La app REAL (`_banco-camino-real.mjs`) por HTTP. ⚠️ El doble de `merchant.findUnique` HONRA EL
// `select`: devuelve sólo los campos pedidos. Sin eso el test no mide nada — un doble que devuelve
// la fila entera tapa justo el defecto, que es un campo que nadie pidió. Y la sesión del banco
// (`sesionesDe`) trae el merchant con los campos de `getSession`, sin `subscriptionStatus`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { montarAppReal, bancoDePrisma, sesionesDe } from './_banco-camino-real.mjs';

const app = await montarAppReal();
after(() => app.cerrar());
const ses = sesionesDe(809, { id: 9, role: 'tecnico', merchantId: 809 });

/** Lo que Prisma devolvería: sólo lo que el `select` pide. */
const proyectar = (fila, select) => (select
  ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, fila[k] ?? null]))
  : fila);

async function meCon(subscriptionStatus) {
  const fila = { ...ses.merchant, country: 'ES', email: 'qa809@test.local', flags: null, subscriptionStatus };
  bancoDePrisma().programar({
    authSession: ses.tabla,
    merchant: { findUnique: async (a) => proyectar(fila, a?.select) },
  });
  const r = await app.pedir('/admin/me', { token: ses.PROPIETARIO });
  assert.equal(r.status, 200, `suelo: /admin/me no respondió 200 (${r.status} ${r.texto?.slice(0, 200)})`);
  assert.ok(Object.hasOwn(r.json, 'subscriptionStatus'), 'suelo: /admin/me ya no devuelve el campo');
  return r.json.subscriptionStatus;
}

test('SCRUM-809b · suelo: la sesión del banco NO trae el estado (como `getSession`)', () => {
  assert.ok(!Object.hasOwn(ses.merchant, 'subscriptionStatus'),
    'el merchant de la sesión del banco trae `subscriptionStatus`: el caso de abajo no mediría el defecto');
});

test('SCRUM-809b · 🔴 un merchant en impago → /admin/me dice past_due (el banner puede salir)', async () => {
  assert.equal(await meCon('past_due'), 'past_due',
    '🔴 /admin/me no lleva el estado real de la suscripción: el banner de impago no sale nunca');
});

test('SCRUM-809b · control: activo → active, y sin estado → null', async () => {
  assert.equal(await meCon('active'), 'active');
  assert.equal(await meCon(null), null);
});
