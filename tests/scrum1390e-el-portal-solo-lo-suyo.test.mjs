// SCRUM-1390e · EL TÉCNICO YA NO SE LLEVA EL PORTAL DE UN CLIENTE CON DOCUMENTOS AJENOS.
//
// J4 lo midió por efecto en SCRUM-1390d (c.20457): `GET /admin/customers/:id/portal-url` le daba
// al Técnico el enlace del portal de CUALQUIER cliente, y la página de ese enlace (`GET
// /cliente/:token`) enseña todos los presupuestos y facturas del cliente sin mirar ningún rol
// (`quote.findMany {customerId}`). Con eso rodeaba la regla entera: «el Técnico ve sólo lo suyo»
// (fundador, SCRUM-1390 c.17962 «1-Sí», c.17963).
//
// Qué hace el arreglo: el enlace se le da a quien vería TODOS los documentos que enseña el portal,
// por las MISMAS dos puertas que la pestaña de documentos de la ficha (SCRUM-1403:
// `wherePresupuestosVisibles`, `whereFacturasVisibles`). No es un criterio nuevo: es el de #2130.
// Y la respuesta de rechazo es la que la ruta ya daba a un cliente que no existe (404 `not_found`):
// ni texto nuevo, ni la pista de que el cliente tiene algo de un compañero.
//
// 🔴 DE PASO, en el mismo fichero: `GET /admin/customers/:id/detail` servía el mismo enlace EN
// CRUDO (`portalToken` y `portalUrl`) cuando el cliente ya tenía token. Era la misma puerta por
// otro sitio, y pasa por la misma pregunta.
//
// SE HABLA POR HTTP CON LA APP REAL Y CONTRA PRISMA DE VERDAD, como SCRUM-1403: banco DESECHABLE
// (`LIBRO_PG_URL`: loopback y base «*_test»). Sin él, los casos con base SALTAN diciendo por qué; la
// mitad sin base (abajo del todo) corre siempre.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import ts from 'typescript';
import { parseBDSegura } from '../scripts/_db-guard.mjs';
import { withMerchant } from './_merchant-fixture.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');

const URL_BANCO = process.env.LIBRO_PG_URL || '';
if (URL_BANCO) {
  const p = parseBDSegura(URL_BANCO);
  if (!p || !['127.0.0.1', 'localhost', '::1'].includes(p.host) || !p.base.endsWith('_test')) {
    throw new Error('🔴 LIBRO_PG_URL no es un banco desechable (loopback y base «*_test»). No se toca nada.');
  }
  process.env.DATABASE_URL = URL_BANCO;
}
const CON_BASE = URL_BANCO !== '';

after(async () => {
  if (!CON_BASE) return;
  const { prisma } = await import('../dist/core/db/prisma.js');
  await prisma.$disconnect();
});

async function montar(app) {
  const server = http.createServer(app).listen(0);
  await new Promise((r) => server.once('listening', r));
  return { port: server.address().port, cerrar: () => new Promise((r) => server.close(r)) };
}

async function sesionDe(prisma, merchantId, teamMemberId) {
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.authSession.create({
    data: { merchantId, teamMemberId, token, type: 'session', expiresAt: new Date(Date.now() + 3600e3) },
  });
  return token;
}

// `node:http` sin agente y no `fetch` (SCRUM-1218c). Devuelve el cuerpo en crudo y, si es JSON, leído.
const pedir = (port, token, ruta) => new Promise((ok, mal) => {
  const headers = token ? { cookie: `pf_session=${token}` } : {};
  const req = http.request({ host: '127.0.0.1', port, path: ruta, method: 'GET', headers, agent: false }, (r) => {
    let d = ''; r.setEncoding('utf8');
    r.on('data', (t) => { d += t; });
    r.on('end', () => {
      let cuerpo = null;
      try { cuerpo = JSON.parse(d); } catch { cuerpo = null; }
      ok({ status: r.statusCode, cuerpo, texto: d });
    });
  });
  req.on('error', mal);
  req.end();
});

/** Un negocio con dos Técnicos y una administradora, y un cliente por cada caso. */
async function negocioDe(prisma, merchant) {
  const miembro = (name, role) => prisma.teamMember.create({
    data: { merchantId: merchant.id, name, email: `qa1390e-${name.toLowerCase()}-${Date.now()}@test.local`, role, status: 'active' },
  });
  const ana = await miembro('Ana', 'tecnico');
  const blas = await miembro('Blas', 'tecnico');
  const jefa = await miembro('Jefa', 'admin');
  const cliente = (nombre) => prisma.customer.create({ data: { merchantId: merchant.id, name: nombre } });
  let n = 0;
  const presupuesto = (c, autorId, extra = {}) => prisma.quote.create({
    data: {
      merchantId: merchant.id, customerId: c.id, total: '100', currency: 'EUR', lines: [],
      quoteNumber: ++n, status: 'accepted', teamMemberId: autorId, ...extra,
    },
  });
  const factura = (c, numero, extra = {}) => prisma.invoice.create({
    data: {
      merchantId: merchant.id, customerId: c.id, number: numero, total: '100', currency: 'EUR',
      pdfUrl: 'PENDING_PDF', qrData: 'PENDING', status: 'pending', type: 'F1', quoteId: null,
      vfEstado: 'no_aplica', ...extra,
    },
  });

  // Lo que el portal de cada cliente enseñaría, y de quién es cada cosa.
  const soloSuyo = await cliente('QA1390E solo suyo');
  const pSuyo = await presupuesto(soloSuyo, ana.id);
  await factura(soloSuyo, 'F-SUYA', { quoteId: pSuyo.id });

  // El de la visita: un presupuesto de la oficina asignado a Ana COMO DOCUMENTO, sin Trabajo aún.
  const asignado = await cliente('QA1390E asignado al documento');
  const pAsignado = await presupuesto(asignado, null, { status: 'sent' });
  await prisma.quoteAssignee.create({ data: { quoteId: pAsignado.id, teamMemberId: ana.id } });

  const vacio = await cliente('QA1390E sin documentos');

  const conPresupuestoAjeno = await cliente('QA1390E presupuesto ajeno');
  await presupuesto(conPresupuestoAjeno, ana.id);
  await presupuesto(conPresupuestoAjeno, blas.id);

  const conFacturaAjena = await cliente('QA1390E factura ajena');
  await presupuesto(conFacturaAjena, ana.id);
  await factura(conFacturaAjena, 'F-OFICINA');

  return { ana, blas, jefa, soloSuyo, asignado, vacio, conPresupuestoAjeno, conFacturaAjena };
}

const tokenEnBase = async (prisma, c) => (await prisma.customer.findUnique({ where: { id: c.id }, select: { portalToken: true } })).portalToken;

// ═════════════════════════════════════════════════════════════════════════════════════════════
// CON BASE
// ═════════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-1390e · 🔴 el Técnico NO se lleva el portal de un cliente con un presupuesto o una factura de otro, y no se le escribe token', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  await withMerchant(prisma, { name: 'QA SCRUM-1390e ajeno', email: `qa-1390e-ajeno-${Date.now()}@test.local` }, async (merchant) => {
    const e = await negocioDe(prisma, merchant);
    const { port, cerrar } = await montar(app);
    try {
      const ana = await sesionDe(prisma, merchant.id, e.ana.id);
      for (const [nombre, c] of [['presupuesto de Blas', e.conPresupuestoAjeno], ['factura de la oficina', e.conFacturaAjena]]) {
        const r = await pedir(port, ana, `/admin/customers/${c.id}/portal-url`);
        assert.equal(r.status, 404, `🔴 la Técnica se lleva el portal de un cliente con un(a) ${nombre} (status ${r.status})`);
        assert.deepEqual(r.cuerpo, { error: 'not_found' }, '🔴 el rechazo no es la respuesta que la ruta ya daba (texto nuevo, o una pista)');
        assert.equal(await tokenEnBase(prisma, c), null, `🔴 pedirlo le ESCRIBE el token al cliente con un(a) ${nombre}`);
      }
      // Un cliente que no existe contesta lo mismo: el rechazo no revela que hay algo de un compañero.
      const noExiste = await pedir(port, ana, '/admin/customers/2147480000/portal-url');
      assert.deepEqual([noExiste.status, noExiste.cuerpo], [404, { error: 'not_found' }]);
    } finally {
      await cerrar();
    }
  });
});

test('SCRUM-1390e · ✅ el Técnico SIGUE llevándose el portal cuando todo lo que enseña es suyo (autor · asignado al documento · sin documentos), y abre', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  await withMerchant(prisma, { name: 'QA SCRUM-1390e suyo', email: `qa-1390e-suyo-${Date.now()}@test.local` }, async (merchant) => {
    const e = await negocioDe(prisma, merchant);
    const { port, cerrar } = await montar(app);
    try {
      const ana = await sesionDe(prisma, merchant.id, e.ana.id);
      for (const [nombre, c] of [['autora', e.soloSuyo], ['asignada al documento', e.asignado], ['sin documentos', e.vacio]]) {
        const r = await pedir(port, ana, `/admin/customers/${c.id}/portal-url`);
        assert.equal(r.status, 200, `🔴 la Técnica ya no se lleva el portal de su cliente (${nombre}): status ${r.status}`);
        const guardado = await tokenEnBase(prisma, c);
        assert.ok(guardado && r.cuerpo.token === guardado, `🔴 (${nombre}) el token devuelto no es el que quedó escrito`);
        assert.ok(r.cuerpo.portalUrl.endsWith(`/cliente/${guardado}`), `🔴 (${nombre}) la URL no lleva el token`);
        // El enlace abre: la cadena entera, no sólo el JSON.
        const pagina = await pedir(port, null, `/cliente/${guardado}`);
        assert.equal(pagina.status, 200, `🔴 (${nombre}) el portal que se le da no abre`);
      }
    } finally {
      await cerrar();
    }
  });
});

test('SCRUM-1390e · ✅ la administradora y la dueña, SIN CAMBIOS: se llevan el portal de cualquier cliente, también con documentos de otros', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  await withMerchant(prisma, { name: 'QA SCRUM-1390e admin', email: `qa-1390e-admin-${Date.now()}@test.local` }, async (merchant) => {
    const e = await negocioDe(prisma, merchant);
    const { port, cerrar } = await montar(app);
    try {
      const jefa = await sesionDe(prisma, merchant.id, e.jefa.id);
      const duena = await sesionDe(prisma, merchant.id, null);
      for (const [quien, token] of [['administradora', jefa], ['dueña', duena]]) {
        for (const c of [e.conPresupuestoAjeno, e.conFacturaAjena, e.soloSuyo, e.vacio]) {
          const r = await pedir(port, token, `/admin/customers/${c.id}/portal-url`);
          assert.equal(r.status, 200, `🔴 la ${quien} ya no se lleva el portal de «${c.name}»`);
          assert.equal(r.cuerpo.token, await tokenEnBase(prisma, c));
          const ficha = await pedir(port, token, `/admin/customers/${c.id}/detail`);
          assert.equal(ficha.cuerpo.customer.portalUrl, r.cuerpo.portalUrl, `🔴 la ficha ya no le da a la ${quien} el enlace de «${c.name}»`);
          assert.equal(ficha.cuerpo.customer.portalToken, r.cuerpo.token);
        }
      }
    } finally {
      await cerrar();
    }
  });
});

test('SCRUM-1390e · 🔴 de paso: la ficha del cliente no le sirve EN CRUDO al Técnico el enlace que portal-url le niega', { skip: !CON_BASE && 'sin LIBRO_PG_URL (banco desechable): corre en el check obligatorio del CI' }, async () => {
  const { prisma } = await import('../dist/core/db/prisma.js');
  const { app } = await import('../dist/app.js');

  await withMerchant(prisma, { name: 'QA SCRUM-1390e ficha', email: `qa-1390e-ficha-${Date.now()}@test.local` }, async (merchant) => {
    const e = await negocioDe(prisma, merchant);
    const { port, cerrar } = await montar(app);
    try {
      const jefa = await sesionDe(prisma, merchant.id, e.jefa.id);
      const ana = await sesionDe(prisma, merchant.id, e.ana.id);
      // La oficina ya le sacó el enlace a todos: el token EXISTE en todos los clientes.
      for (const c of [e.conPresupuestoAjeno, e.conFacturaAjena, e.soloSuyo]) {
        assert.equal((await pedir(port, jefa, `/admin/customers/${c.id}/portal-url`)).status, 200);
      }
      for (const c of [e.conPresupuestoAjeno, e.conFacturaAjena]) {
        const ficha = await pedir(port, ana, `/admin/customers/${c.id}/detail`);
        assert.equal(ficha.status, 200, '🔴 la ficha del cliente ya no se le abre a la Técnica (SCRUM-1403)');
        assert.equal(ficha.cuerpo.customer.portalUrl, null, `🔴 la ficha de «${c.name}» le da a la Técnica el enlace del portal`);
        assert.equal(ficha.cuerpo.customer.portalToken, null, `🔴 la ficha de «${c.name}» le da a la Técnica el token del portal`);
        assert.ok(!ficha.texto.includes(await tokenEnBase(prisma, c)), `🔴 el token de «${c.name}» viaja en el cuerpo de la ficha`);
      }
      // Y en el suyo, se le sigue dando.
      const suya = await pedir(port, ana, `/admin/customers/${e.soloSuyo.id}/detail`);
      assert.equal(suya.cuerpo.customer.portalToken, await tokenEnBase(prisma, e.soloSuyo), '🔴 la ficha de su cliente ya no le da el enlace');
    } finally {
      await cerrar();
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════════════════════
// SIN BASE · corre siempre.
// ═════════════════════════════════════════════════════════════════════════════════════════════

const RUTAS_CLIENTE = 'src/modules/system/app/routes/customersAdmin.routes.ts';
const PREGUNTA = 'puedeLlevarseElPortal';

/**
 * Las que el meta-guard ejecuta (SCRUM-1387). Su job corre SIN base, así que sólo van las que tumba
 * la mitad AST. Las cuatro caen también con base: lo mide `docs/master/evidencias/SCRUM-1390e/mutar.mjs`.
 */
// 🔴 Cada campo, LITERAL: el lector del meta-guard (SCRUM-757) no resuelve variables, y con
// `RUTAS_CLIENTE` o `CASO_*` aquí la declaración salía ilegible y tumbaba 745/757/765.
export const MUTACIONES_QUE_ME_TUMBAN = [
  { fichero: 'src/modules/system/app/routes/customersAdmin.routes.ts', de: "    if (!(await puedeLlevarseElPortal(req, id))) return res.status(404).json({ error: 'not_found' });\n", a: '\n', cae: 'SCRUM-1390e · portal-url pregunta ANTES de escribir el token' },
  { fichero: 'src/modules/system/app/routes/customersAdmin.routes.ts', de: '    if (customer.portalToken && !(await puedeLlevarseElPortal(req, id))) customer.portalToken = null;\n', a: '\n', cae: 'SCRUM-1390e · portal-url pregunta ANTES de escribir el token' },
  { fichero: 'src/modules/system/app/routes/customersAdmin.routes.ts', de: 'const recorteFacturas = await whereFacturasVisibles(quien);', a: 'const recorteFacturas = null;', cae: 'SCRUM-1390e · la pregunta no es un criterio nuevo' },
  { fichero: 'src/modules/system/app/routes/customersAdmin.routes.ts', de: 'const recortePresupuestos = await wherePresupuestosVisibles(quien);', a: 'const recortePresupuestos = null;', cae: 'SCRUM-1390e · la pregunta no es un criterio nuevo' },
];

/** Las que sólo ve la base (la cuenta, no la llamada). Las ejecuta el mismo guion, con el banco PGlite. */
export const MUTACIONES_CON_BASE = [
  { fichero: 'src/modules/system/app/routes/customersAdmin.routes.ts', de: 'return presupuestos === suyos && facturas === suyas;', a: 'return presupuestos === suyos;', cae: 'SCRUM-1390e · 🔴 el Técnico NO se lleva el portal' },
  { fichero: 'src/modules/system/app/routes/customersAdmin.routes.ts', de: 'return presupuestos === suyos && facturas === suyas;', a: 'return facturas === suyas;', cae: 'SCRUM-1390e · 🔴 el Técnico NO se lleva el portal' },
];

const sf =ts.createSourceFile(RUTAS_CLIENTE, fs.readFileSync(path.join(RAIZ, RUTAS_CLIENTE), 'utf8'), ts.ScriptTarget.Latest, true);

function manejadorGet(ruta) {
  let out = null;
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.expression.getText(sf) === 'router' && n.expression.name.text === 'get'
      && n.arguments.length >= 2 && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === ruta) {
      out = n.arguments[n.arguments.length - 1];
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return out;
}

/** Las LLAMADAS a `nombre` dentro de un nodo, con su posición. Un comentario no es una llamada. */
function llamadasA(nodo, nombre) {
  const out = [];
  const visita = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nombre) out.push(n.getStart());
    ts.forEachChild(n, visita);
  };
  visita(nodo);
  return out;
}

test('SCRUM-1390e · portal-url pregunta ANTES de escribir el token, y la ficha pregunta lo mismo', () => {
  const portal = manejadorGet('/:id/portal-url');
  assert.ok(portal, `🔴 CIEGO: no encuentro router.get('/:id/portal-url') en ${RUTAS_CLIENTE}`);
  const pregunta = llamadasA(portal, PREGUNTA);
  const escribe = llamadasA(portal, 'ensurePortalToken');
  assert.equal(escribe.length, 1, '🔴 CIEGO: portal-url ya no llama a ensurePortalToken; re-mide qué es «dar el enlace»');
  assert.equal(pregunta.length, 1, `🔴 portal-url no pregunta ${PREGUNTA}`);
  assert.ok(pregunta[0] < escribe[0], '🔴 portal-url escribe el token ANTES de preguntar');

  const ficha = manejadorGet('/:id/detail');
  assert.ok(ficha, `🔴 CIEGO: no encuentro router.get('/:id/detail') en ${RUTAS_CLIENTE}`);
  assert.equal(llamadasA(ficha, PREGUNTA).length, 1, `🔴 la ficha del cliente no pregunta ${PREGUNTA} antes de servir el enlace`);
});

test('SCRUM-1390e · la pregunta no es un criterio nuevo: pide sus recortes a las dos puertas de SCRUM-1403', () => {
  let fn = null;
  const visita = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name && n.name.text === PREGUNTA) fn = n;
    ts.forEachChild(n, visita);
  };
  visita(sf);
  assert.ok(fn, `🔴 CIEGO: no encuentro la función ${PREGUNTA} en ${RUTAS_CLIENTE}`);
  assert.equal(llamadasA(fn, 'wherePresupuestosVisibles').length, 1, '🔴 la pregunta no pide el recorte de presupuestos a su puerta');
  assert.equal(llamadasA(fn, 'whereFacturasVisibles').length, 1, '🔴 la pregunta no pide el recorte de facturas a su puerta');
  // Ningún eje propio: ni autor, ni asignados, ni Trabajos escritos aquí al lado.
  const ejes = [];
  const busca = (n) => {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && ['teamMemberId', 'asignados', 'operarioId', 'assignedUserId', 'assignees', 'jobId'].includes(n.name.text)) ejes.push(n.name.text);
    ts.forEachChild(n, busca);
  };
  busca(fn);
  assert.deepEqual(ejes, [], '🔴 la pregunta escribe sus propios ejes de «suyo»: es el segundo criterio');
});
