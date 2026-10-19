// tests/scrum1390b-ics-sin-trabajo-ajeno.test.mjs — SCRUM-1390b
//
// ═══════════════════════════════════════════════════════════════════════════════════════════════
// `GET /admin/jobs/:id/ics` NO ENTREGA LA CITA DE UN TRABAJO QUE NO ES DEL TÉCNICO.
//
// El censo de SCRUM-1390 (y la sonda de frontera de SCRUM-1516) lo dejaron medido: la ruta busca el
// Trabajo por `id` y negocio, y su hermana `GET /admin/jobs/:id` además niega al técnico el Trabajo
// de otro (SCRUM-23). El `.ics` lleva el nombre del cliente, el número del presupuesto, la fecha y
// las notas: un técnico que no puede ABRIR el Trabajo se bajaba su cita.
//
// Entre COMERCIOS no había fuga: el `where` lleva `merchantId` desde el principio. Esto es el eje
// del ROL dentro de un mismo comercio.
//
// Se corre el handler REAL de `dist/` con `prisma` de doble (patrón de SCRUM-849 ⑦). Tres casos y
// los tres hacen falta: sin el del dueño, un 404 para todos también pasaría; sin el del
// administrador, un filtro que cerrara a todo el que no es el operario también.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import { reqDeSesion } from './_arnes-de-router.mjs';

const MERCHANT = 7;
const DUENO = 11;
const AJENO = 99;

const TRABAJO = {
  id: 42, merchantId: MERCHANT, customerId: 5, quoteId: null, operarioId: DUENO, assignedUserId: DUENO,
  status: 'agendado', scheduledAt: new Date('2026-10-20T08:00:00Z'), notes: 'Llave en el buzón',
  createdAt: new Date('2026-10-01T08:00:00Z'), updatedAt: new Date('2026-10-01T08:00:00Z'),
};

async function pedirIcsComo({ rol, teamMemberId }) {
  const moduloPrisma = await import('../dist/core/db/prisma.js');
  const p = moduloPrisma.prisma;
  p.job = { findFirst: async ({ where }) => (where?.id === TRABAJO.id && where?.merchantId === MERCHANT ? TRABAJO : null) };
  p.quote = { findUnique: async () => null, findMany: async () => [] };
  p.customer = { findUnique: async () => ({ id: 5, name: 'Ferretería Pepe' }) };
  p.teamMember = { findFirst: async () => ({ id: DUENO, name: 'Ana' }) };
  p.jobAssignee = { findMany: async () => [] };
  p.albaran = { findMany: async () => [] };

  const mod = await import('../dist/modules/jobs/app/routes/jobs.routes.js');
  const router = mod.default?.default ?? mod.default;
  const capa = router.stack.find((l) => l.route?.path === '/:id/ics' && l.route?.methods?.get);
  assert.ok(capa, '🔴 no existe GET /:id/ics: no hay nada que medir');

  let salida = null;
  const res = {
    _c: 200, _h: {},
    status(c) { this._c = c; return this; },
    setHeader(k, v) { this._h[k.toLowerCase()] = v; return this; },
    json(b) { salida = { code: this._c, json: b, headers: this._h }; return this; },
    send(b) { salida = { code: this._c, texto: String(b), headers: this._h }; return this; },
  };
  const hs = capa.route.stack;
  await hs[hs.length - 1].handle(
    reqDeSesion({ rol, merchantId: MERCHANT, teamMemberId, params: { id: String(TRABAJO.id) }, body: {}, query: {}, headers: {} }),
    res, () => {},
  );
  assert.ok(salida, '🔴 el handler no contestó: el doble no llega a donde tiene que llegar');
  return salida;
}

test('SCRUM-1390b · 🔴 un técnico NO se baja el .ics de un Trabajo que no es suyo', async () => {
  const r = await pedirIcsComo({ rol: 'tecnico', teamMemberId: AJENO });
  assert.equal(r.code, 404,
    `🔴 EL TÉCNICO AJENO SE BAJÓ LA CITA DE OTRO TRABAJO (${r.code}). No puede abrirlo por `
    + 'GET /admin/jobs/:id y sí bajarse su calendario, con el cliente y las notas dentro.');
  assert.deepEqual(r.json, { error: 'not_found' },
    '🔴 la negativa no es la misma que la de su hermana GET /:id (404 not_found, que no delata que existe)');
  assert.equal(r.texto, undefined, '🔴 se mandó el calendario en una petición denegada');
});

test('SCRUM-1390b · control: el técnico DUEÑO sigue bajándose su cita', async () => {
  const r = await pedirIcsComo({ rol: 'tecnico', teamMemberId: DUENO });
  assert.equal(r.code, 200, `🔴 EL DUEÑO YA NO PUEDE AÑADIR SU TRABAJO AL CALENDARIO (${r.code}, ${JSON.stringify(r.json)})`);
  assert.match(r.headers['content-type'] ?? '', /^text\/calendar/);
  assert.match(r.texto ?? '', /UID:job-42@yaqu\.app/);
  assert.match(r.texto ?? '', /Ferretería Pepe/, '🔴 el control no mide nada: la cita no lleva al cliente');
});

test('SCRUM-1390b · control: el administrador se baja la cita de cualquier Trabajo de su comercio', async () => {
  const r = await pedirIcsComo({ rol: 'admin', teamMemberId: null });
  assert.equal(r.code, 200, `🔴 el filtro cierra también al administrador (${r.code})`);
  assert.match(r.texto ?? '', /UID:job-42@yaqu\.app/);
});
