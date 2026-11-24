// SCRUM-1555b · el login de pruebas abre sesión también como miembro de equipo (decisión del
// fundador, SCRUM-1555 c.22569: «Login de pruebas con rol»). Contra la ruta MONTADA en `dist/app.js`
// (banco de SCRUM-597: la app real con un doble de Prisma; cero base, cero staging).
// La sesión que se mide es la que ESCRIBE el handler (`authSession.create`): el rol sale de esa fila,
// como en producción (`requireAuth` lo lee de `session.teamMember.role`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bancoDePrisma, montarAppReal, sesionesDe } from './_banco-camino-real.mjs';

const MERCHANT = 15551;
const PROPIETARIA = 'qa-1555b@yaqu.test';
const TECNICO = { id: 15552, name: 'Técnico 1555b', email: 'tecnico-1555b@yaqu.test', role: 'tecnico', status: 'active', active: true, merchantId: MERCHANT };
const SECRETO = 'fixture-1555b-no-es-el-de-staging';

function gate(encendido) {
  if (encendido) {
    process.env.E2E_TEST_LOGIN_ENABLED = 'true';
    process.env.E2E_TEST_LOGIN_SECRET = SECRETO;
    process.env.E2E_TEST_LOGIN_EMAILS = PROPIETARIA;
  } else {
    delete process.env.E2E_TEST_LOGIN_ENABLED;
  }
}

async function banco() {
  const ses = sesionesDe(MERCHANT, TECNICO);
  const vivas = {};
  let ultima = null;
  bancoDePrisma().programar({
    authSession: {
      create: async (a) => {
        const id = a.data.teamMemberId ?? null;
        ultima = { id: 99, ...a.data, merchant: ses.merchant, teamMember: id === null ? null : (id === TECNICO.id ? TECNICO : undefined) };
        vivas[a.data.token] = ultima;
        return ultima;
      },
      findUnique: async (a) => vivas[a?.where?.token] ?? null,
    },
    merchant: { findUnique: async (a) => (a?.where?.email === PROPIETARIA || a?.where?.id === MERCHANT ? { ...ses.merchant, email: PROPIETARIA } : null) },
    teamMember: {
      findFirst: async (a) => (a?.where?.email === TECNICO.email && a?.where?.merchantId === MERCHANT ? TECNICO : null),
      findMany: async () => [],
    },
  });
  return { app: await montarAppReal(), ultima: () => ultima };
}

const creadas = () => bancoDePrisma().escrituras.filter((e) => e.modelo === 'authSession' && e.op === 'create');

test('SCRUM-1555b · 🔴 con `miembro` la sesión es la del Técnico y una ruta de propietario le da 403', async () => {
  gate(true);
  const { app, ultima } = await banco();
  const r = await app.pedir('/auth/test-login', { metodo: 'POST', cuerpo: { email: PROPIETARIA, secret: SECRETO, miembro: TECNICO.email } });
  assert.equal(r.status, 200, `🔴 test-login con miembro contesta ${r.status}: ${r.texto}`);
  assert.equal(creadas().length, 1, '🔴 esperaba UNA sesión escrita');
  assert.equal(ultima().teamMemberId, TECNICO.id, '🔴 la sesión no lleva el teamMemberId del Técnico: abre como propietario');
  const equipo = await app.pedir('/admin/team', { token: ultima().token });
  assert.equal(equipo.status, 403, `🔴 el Técnico entra en /admin/team (${equipo.status}): la sesión no lleva su rol`);
  assert.equal(equipo.json?.error, 'forbidden');
});

test('SCRUM-1555b · el cuerpo de hoy (sin `miembro`) sigue abriendo la sesión de la propietaria', async () => {
  gate(true);
  const { app, ultima } = await banco();
  const r = await app.pedir('/auth/test-login', { metodo: 'POST', cuerpo: { email: PROPIETARIA, secret: SECRETO } });
  assert.equal(r.status, 200, `test-login sin miembro contesta ${r.status}: ${r.texto}`);
  assert.equal(ultima().teamMemberId ?? null, null, '🔴 sin miembro la sesión ya no es de la propietaria');
  const equipo = await app.pedir('/admin/team', { token: ultima().token });
  assert.ok(![401, 403].includes(equipo.status), `🔴 la propietaria no entra en /admin/team (${equipo.status}): ${equipo.texto}`);
});

test('SCRUM-1555b · 🔴 un `miembro` que no es del comercio da 404 team_member_not_found y no abre sesión', async () => {
  gate(true);
  const { app } = await banco();
  const r = await app.pedir('/auth/test-login', { metodo: 'POST', cuerpo: { email: PROPIETARIA, secret: SECRETO, miembro: 'nadie-1555b@yaqu.test' } });
  assert.equal(r.status, 404, `🔴 miembro inexistente contesta ${r.status}: ${r.texto}`);
  assert.equal(r.json?.error, 'team_member_not_found', `🔴 el 404 no dice qué falta: ${r.texto}`);
  // SCRUM-1555c: el texto humano, literal firmado en SCRUM-1555 c.22642 (regla 39).
  assert.equal(r.json?.message, 'No hay ningún miembro del equipo con ese correo en esta cuenta.', `🔴 el 404 no lleva el texto firmado: ${r.texto}`);
  assert.equal(creadas().length, 0, '🔴 con un miembro inexistente se escribió una sesión');
});

test('SCRUM-1555b · con el gate apagado la ruta no existe (404) y no escribe nada, también con `miembro`', async () => {
  gate(false);
  const { app } = await banco();
  const r = await app.pedir('/auth/test-login', { metodo: 'POST', cuerpo: { email: PROPIETARIA, secret: SECRETO, miembro: TECNICO.email } });
  assert.equal(r.status, 404, `🔴 con el gate apagado contesta ${r.status}`);
  assert.notEqual(r.json?.error, 'team_member_not_found', '🔴 con el gate apagado el handler llegó a buscar el miembro');
  assert.equal(creadas().length, 0, '🔴 con el gate apagado se escribió una sesión');
});
