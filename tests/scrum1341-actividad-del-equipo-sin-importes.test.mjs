// tests/scrum1341-actividad-del-equipo-sin-importes.test.mjs — SCRUM-1341
//
// EL TÉCNICO VE LA ACTIVIDAD DE SUS COMPAÑEROS. NI UN EURO.
//
// El fundador firmó dos cosas el 1-oct-2026: «el operario ve la actividad de sus compañeros»
// (SCRUM-1337) y «cobrado / gastos / beneficio → ❌ para el Técnico» (tabla S1). El panel
// «Rendimiento del equipo» (`GET /admin/metrics/team`) reparte lo COBRADO del mes por persona.
// La decisión («1-B»): actividad sí, dinero no — con una ruta propia, `/admin/metrics/actividad-equipo`.
//
// Todo se mide por EFECTO: los routers reales de `dist/` con la base doblada, y el panel real en
// el banco de vistas. Nada se decide leyendo el fuente.
//
//   ① EL ROJO DE HOY, QUE SE QUEDA: `/admin/metrics/team` le sigue contestando 403 al Técnico.
//   ② EL CONTROL QUE DECIDE: sobre la respuesta REAL de la ruta nueva, campo a campo, no sale el
//      dinero por ninguno de los cinco mecanismos medidos en `docs/evidencias/scrum1341/`:
//      `members[].collected` · `members[].isBest` · `totalCollected` · `sinAsignar.collected` y
//      `.label` · y que `sinAsignar` EXISTA. Seis escenarios que SÓLO difieren en lo cobrado
//      tienen que dar la MISMA respuesta, byte a byte — y la del admin, con los mismos datos,
//      tiene que moverse: si no se mueve, el instrumento no ve el dinero y el control no vale.
//   ③ EL POSITIVO QUE PROTEGE LO GANADO: el admin sigue viendo su panel, importes incluidos.
//   ④ LA PANTALLA: el Técnico ve el título firmado y tres columnas; el admin, lo de siempre.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { cargarDashboard, pintarVista, todos } from './_banco-vistas.mjs';

const RAIZ = path.resolve(import.meta.dirname, '..');
const require_ = createRequire(path.join(RAIZ, 'package.json'));

const RUTA_NUEVA = '/admin/metrics/actividad-equipo';
const RUTA_DEL_ADMIN = '/admin/metrics/team';
/** El literal que firmó el fundador (SCRUM-1341, comentario 17827). Ni una palabra distinta. */
const TITULO_FIRMADO = 'Actividad del equipo · este mes';

// ── LA BASE DOBLADA ──────────────────────────────────────────────────────────────────────────
// El doble NO aplica `select`: devuelve las filas ENTERAS, con dinero y con datos de más. Así un
// `...fila` en el servicio —o un campo que se cuele— aparece en la respuesta en vez de quedarse
// escondido detrás de un doble obediente.

const AHORA = new Date();
const HACE_DIEZ = new Date(AHORA.getTime() - 10 * 86_400_000);

const MIEMBROS = [
  { id: 11, merchantId: 42, name: 'Ana', email: 'ana@example.com', role: 'tecnico', status: 'active' },
  { id: 12, merchantId: 42, name: 'Blas', email: 'blas@example.com', role: 'tecnico', status: 'active' },
  { id: 13, merchantId: 42, name: 'Caro', email: 'caro@example.com', role: 'tecnico', status: 'active' },
  { id: 14, merchantId: 42, name: 'Dani', email: 'dani@example.com', role: 'admin', status: 'active' },
];
const q = (id, teamMemberId, status, createdAt, total) => ({ id, merchantId: 42, teamMemberId, status, createdAt, total, currency: 'EUR' });
const PRESUPUESTOS = [
  q(101, 11, 'accepted', AHORA, 410.17),
  q(102, 11, 'accepted', AHORA, 520.19),
  q(103, 11, 'sent', AHORA, 630.23),
  q(104, 12, 'sent', AHORA, 740.29),
  q(105, 13, 'rejected', HACE_DIEZ, 850.31),
  q(106, null, 'accepted', AHORA, 960.37),
];
const f = (total, tm) => ({ total, quoteId: 1, quote: { teamMemberId: tm } });
const suelto = (total) => ({ total, quoteId: null, quote: null });

/** Los escenarios SÓLO difieren en lo cobrado. Importes con céntimos: no se confunden con un recuento. */
const ESCENARIOS = {
  'A · Ana 100,37 · Blas 900,41 · suelto 50,13': [f(100.37, 11), f(900.41, 12), suelto(50.13)],
  'B · Ana 900,41 · Blas 100,37 · suelto 50,13': [f(900.41, 11), f(100.37, 12), suelto(50.13)],
  'C · como A, sin cobros sueltos': [f(100.37, 11), f(900.41, 12)],
  'D · nadie ha cobrado nada': [],
  'E · sólo cobra la dueña 300,29': [f(300.29, null)],
  'F · Caro cobra 5000,53': [f(5000.53, 13)],
};
let facturasCobradas = [];

/** Cada llamada a la base: `modelo.metodo` y sus argumentos. */
const llamadas = [];
const modelo = (nombre) => new Proxy({}, {
  get: (_t, metodo) => async (args) => {
    llamadas.push({ op: `${nombre}.${String(metodo)}`, args });
    if (nombre === 'merchant') return { id: 42, name: 'Taller', legalName: 'Dueña SL', email: 'taller@example.com', taxId: 'B00000000' };
    if (nombre === 'teamMember') return MIEMBROS;
    if (nombre === 'quote') return PRESUPUESTOS;
    if (nombre === 'invoice') return facturasCobradas;
    return [];
  },
});
const prisma = new Proxy({}, { get: (_t, nombre) => modelo(String(nombre)) });
const R_PRISMA = require_.resolve('./dist/core/db/prisma.js');
require_.cache[R_PRISMA] = { id: R_PRISMA, filename: R_PRISMA, loaded: true, exports: { prisma } };

const express = require_('express');
const routerDeMetricas = require_('./dist/modules/metrics/app/routes/metrics.routes.js').default;
const { TECNICO_ALLOWED, PENDIENTE_MAX, PENDIENTE_CLASIFICAR } = require_('./dist/core/http/adminRouteDeclarations.js');
const { ADMIN_ONLY_ROUTES } = require_('./dist/core/http/adminOnlyRoutes.js');

/** `agent: false`, nunca `fetch`: ver el aviso de libuv en scrum1107b. */
function peticion(puerto, url) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: puerto, path: url, method: 'GET', agent: false }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (t) => { data += t; });
      res.on('end', () => {
        let cuerpo = null;
        try { cuerpo = data ? JSON.parse(data) : null; } catch { /* se deja null */ }
        resolve({ status: res.statusCode, crudo: data, cuerpo });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/** Pide `url` con la sesión de `userRole` y dice qué contestó y qué le pidió a la base. */
async function pedir(userRole, url) {
  const app = express();
  app.use((req, _res, next) => { req.merchantId = 42; req.userRole = userRole; next(); });
  app.use('/admin/metrics', routerDeMetricas);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const antes = llamadas.length;
  try {
    const r = await peticion(server.address().port, url);
    return { ...r, base: llamadas.slice(antes) };
  } finally {
    await new Promise((r) => server.close(r));
  }
}

/** Aplana un valor a `{ ruta: valor }`. Las filas de `members` se nombran por persona. */
function aplanar(v, pre = '', sal = {}) {
  if (Array.isArray(v)) {
    if (v.length === 0) sal[`${pre}[]`] = '(vacía)';
    v.forEach((x, i) => aplanar(x, `${pre}[${x && typeof x === 'object' && 'name' in x ? x.name : i}]`, sal));
    if (v[0] && typeof v[0] === 'object' && 'name' in v[0]) sal[`${pre}.ORDEN`] = v.map((x) => x.name).join(' > ');
  } else if (v && typeof v === 'object') {
    for (const k of Object.keys(v)) aplanar(v[k], pre ? `${pre}.${k}` : k, sal);
  } else {
    sal[pre] = v;
  }
  return sal;
}

/** Todas las CLAVES que aparecen en una respuesta, a cualquier profundidad. */
function claves(v, sal = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => claves(x, sal));
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) { sal.add(k); claves(v[k], sal); }
  return sal;
}

/** Las dos respuestas de cada escenario: la del Técnico en su ruta y la del admin en la suya. */
async function correrEscenarios() {
  const filas = [];
  for (const [nombre, facturas] of Object.entries(ESCENARIOS)) {
    facturasCobradas = facturas;
    const tecnico = await pedir('tecnico', RUTA_NUEVA);
    const admin = await pedir('admin', RUTA_DEL_ADMIN);
    filas.push({ nombre, facturas, tecnico, admin });
  }
  facturasCobradas = [];
  return filas;
}

// ── ① EL ROJO DE HOY, QUE SE QUEDA ───────────────────────────────────────────────────────────

test('SCRUM-1341 · 🔴 `/admin/metrics/team` le sigue contestando 403 al Técnico, y antes de tocar la base', async () => {
  facturasCobradas = ESCENARIOS['A · Ana 100,37 · Blas 900,41 · suelto 50,13'];
  const tecnico = await pedir('tecnico', RUTA_DEL_ADMIN);
  assert.equal(tecnico.status, 403, '🔴 la ruta del dinero del equipo deja pasar al Técnico');
  assert.equal(tecnico.base.length, 0, '🔴 la ruta del dinero niega TARDE: ya había consultado la base');
  assert.equal((await pedir('comercial', RUTA_DEL_ADMIN)).status, 403, '🔴 un rol desconocido llega a la ruta del dinero');

  // Control: el admin SÍ pasa y el handler corre. Sin él, el 403 de arriba no probaría nada.
  const admin = await pedir('admin', RUTA_DEL_ADMIN);
  assert.equal(admin.status, 200, '🔴 la ruta del admin le niega al admin');
  assert.ok(admin.base.some((l) => l.op === 'invoice.findMany'), '🔴 CIEGO: el arnés no llega al handler del admin');
});

test('SCRUM-1341 · las dos rutas están DECLARADAS: la nueva con su motivo, la del admin con su 403, y el tope sigue en 0', () => {
  const decl = TECNICO_ALLOWED.filter((r) => r.method === 'GET' && r.path === RUTA_NUEVA);
  assert.equal(decl.length, 1, '🔴 la ruta nueva no está declarada en TECNICO_ALLOWED exactamente una vez');
  assert.match(decl[0].why, /SCRUM-1341/, '🔴 el motivo de la ruta nueva no dice de qué decisión sale');
  assert.match(decl[0].why, /sin ningún importe/, '🔴 el motivo no dice lo que la ruta NO da');

  assert.equal(ADMIN_ONLY_ROUTES.filter((r) => r.method === 'GET' && r.path === RUTA_DEL_ADMIN).length, 1,
    '🔴 `/admin/metrics/team` ha salido de la lista que le exige 403 al Técnico');
  assert.equal(TECNICO_ALLOWED.filter((r) => r.path === RUTA_DEL_ADMIN).length, 0,
    '🔴 `/admin/metrics/team` se ha abierto al Técnico');

  assert.equal(PENDIENTE_MAX, 0, '🔴 PENDIENTE_MAX ha subido: una ruta nueva se declara, no se aparca');
  assert.equal(PENDIENTE_CLASIFICAR.length, 0, '🔴 hay rutas aparcadas sin clasificar');
});

// ── ② NI UN EURO ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-1341 · ✅ la ruta nueva le contesta 200 al Técnico, con una lista CERRADA de campos — sin `id`', async () => {
  const r = await pedir('tecnico', RUTA_NUEVA);
  assert.equal(r.status, 200, `🔴 la ruta del Técnico no le contesta: ${r.status}`);
  assert.deepEqual(Object.keys(r.cuerpo).sort(), ['hasTeam', 'members'],
    '🔴 la respuesta lleva otras claves: cada clave nueva es una decisión de permisos');
  assert.equal(r.cuerpo.members.length, MIEMBROS.length + 1, '🔴 CIEGO: no salen el propietario y los cuatro miembros');
  for (const m of r.cuerpo.members) {
    assert.deepEqual(Object.keys(m).sort(), ['acceptanceRate', 'accepted', 'name', 'role', 'sent', 'status', 'thisWeek'],
      `🔴 la fila de ${m.name} lleva otros campos: cada campo nuevo es una decisión de permisos`);
  }
  // Un admin también puede pedirla: es actividad, no un secreto del Técnico.
  assert.equal((await pedir('admin', RUTA_NUEVA)).status, 200);
});

test('SCRUM-1341 · 🔴 NI UN EURO: seis escenarios que sólo difieren en lo cobrado dan la MISMA respuesta, ruta a ruta', async () => {
  const filas = await correrEscenarios();
  assert.equal(filas.length, 6, '🔴 CIEGO: no han corrido los seis escenarios');

  // El control del instrumento, PRIMERO: con los mismos datos, la respuesta del admin SE MUEVE,
  // y por los cinco mecanismos. Si no, el doble no sirve dinero y «no cambia» no significa nada.
  const planosAdmin = filas.map((x) => aplanar(x.admin.cuerpo));
  const rutasAdmin = [...new Set(planosAdmin.flatMap((p) => Object.keys(p)))].sort();
  const seMueven = rutasAdmin.filter((ruta) => new Set(planosAdmin.map((p) => (ruta in p ? String(p[ruta]) : '(no existe)'))).size > 1);
  const mecanismos = [...new Set(seMueven.map((ruta) => ruta.replace(/\[[^\]]*\]/g, '[]')))].sort();
  assert.deepEqual(mecanismos, ['members[].collected', 'members[].isBest', 'sinAsignar', 'sinAsignar.collected', 'sinAsignar.label', 'totalCollected'],
    '🔴 CIEGO: el panel del admin ya no saca el dinero por los caminos medidos; este control mide otra cosa');

  // Y ahora lo que decide: la del Técnico no se mueve. Ni un byte.
  const planosTecnico = filas.map((x) => aplanar(x.tecnico.cuerpo));
  const rutasTecnico = [...new Set(planosTecnico.flatMap((p) => Object.keys(p)))].sort();
  assert.ok(rutasTecnico.length >= 30, `🔴 CIEGO: la respuesta del Técnico sólo tiene ${rutasTecnico.length} rutas; no se ha medido nada`);
  const delatoras = rutasTecnico.filter((ruta) => new Set(planosTecnico.map((p) => (ruta in p ? String(p[ruta]) : '(no existe)'))).size > 1);
  assert.deepEqual(delatoras, [],
    `\n🔴 LA RESPUESTA DEL TÉCNICO CAMBIA CON LO COBRADO (${delatoras.length} de ${rutasTecnico.length} rutas):\n   · ${delatoras.join('\n   · ')}\n`);
  assert.equal(new Set(filas.map((x) => x.tecnico.crudo)).size, 1, '🔴 el JSON del Técnico no es idéntico entre escenarios');
  assert.equal(new Set(filas.map((x) => x.admin.crudo)).size, 6, '🔴 CIEGO: el JSON del admin no distingue los seis escenarios');
});

test('SCRUM-1341 · 🔴 los cinco mecanismos, uno a uno, sobre la respuesta real — y ningún importe en ningún valor', async () => {
  const filas = await correrEscenarios();
  const PROHIBIDAS = ['collected', 'isBest', 'totalCollected', 'sinAsignar', 'label', 'id', 'inactive', 'email', 'total'];

  for (const x of filas) {
    const delTecnico = claves(x.tecnico.cuerpo);
    const coladas = PROHIBIDAS.filter((k) => delTecnico.has(k));
    assert.deepEqual(coladas, [], `🔴 [${x.nombre}] la respuesta del Técnico lleva: ${coladas.join(', ')}`);
    // El quinto mecanismo: que la clave EXISTA ya delata un cobro sin presupuesto, valga lo que valga.
    assert.equal(Object.hasOwn(x.tecnico.cuerpo, 'sinAsignar'), false, `🔴 [${x.nombre}] \`sinAsignar\` existe en la respuesta del Técnico`);

    // Ningún VALOR de la respuesta es un importe: ni lo cobrado (por factura, por persona o en
    // total) ni el total de un presupuesto. Los importes llevan céntimos; los recuentos no.
    const importes = new Set([
      ...x.facturas.map((i) => i.total),
      ...PRESUPUESTOS.map((p) => p.total),
      ...Object.entries(aplanar(x.admin.cuerpo)).filter(([ruta]) => /collected|totalCollected/.test(ruta)).map(([, v]) => v),
    ].filter((n) => typeof n === 'number' && n !== 0));
    const valores = Object.values(aplanar(x.tecnico.cuerpo));
    const euros = valores.filter((v) => importes.has(v) || (typeof v === 'number' && !Number.isInteger(v)));
    assert.deepEqual(euros, [], `🔴 [${x.nombre}] en la respuesta del Técnico hay un importe: ${euros.join(', ')}`);
  }

  // Control: en la del admin SÍ están, clave a clave. Sin esto, `PROHIBIDAS` podría no nombrar nada real.
  const conSuelto = filas[0];
  const delAdmin = claves(conSuelto.admin.cuerpo);
  for (const k of ['collected', 'isBest', 'totalCollected', 'sinAsignar', 'label', 'id', 'inactive']) {
    assert.ok(delAdmin.has(k), `🔴 CIEGO: el panel del admin ya no devuelve \`${k}\`; la lista de prohibidas no mide nada`);
  }
  assert.equal(conSuelto.admin.cuerpo.totalCollected, 1050.91, '🔴 CIEGO: el admin no suma lo cobrado del escenario');
  assert.equal(filas[3].admin.cuerpo.sinAsignar, null, '🔴 CIEGO: sin cobros sueltos, `sinAsignar` del admin no es null');
});

test('SCRUM-1341 · 🔴 por EFECTO en la base: la ruta nueva no consulta facturas, ni pide el total de un presupuesto', async () => {
  facturasCobradas = ESCENARIOS['A · Ana 100,37 · Blas 900,41 · suelto 50,13'];
  const r = await pedir('tecnico', RUTA_NUEVA);
  assert.deepEqual(r.base.map((l) => l.op).sort(), ['merchant.findUnique', 'quote.findMany', 'teamMember.findMany'],
    '🔴 la ruta del Técnico le pide a la base otra cosa que el negocio, sus miembros y sus presupuestos del mes');

  const de = (op) => r.base.find((l) => l.op === op).args;
  assert.deepEqual(Object.keys(de('quote.findMany').select).sort(), ['createdAt', 'status', 'teamMemberId'],
    '🔴 la ruta del Técnico lee de los presupuestos algo más que autor, estado y fecha');
  assert.deepEqual(Object.keys(de('teamMember.findMany').select).sort(), ['id', 'name', 'role', 'status']);
  assert.deepEqual(Object.keys(de('merchant.findUnique').select).sort(), ['legalName', 'name']);
  // Regla 2: todo filtra por el merchant de la sesión.
  assert.equal(de('quote.findMany').where.merchantId, 42);
  assert.equal(de('teamMember.findMany').where.merchantId, 42);
  assert.equal(de('merchant.findUnique').where.id, 42);
  // Los borradores no son actividad, igual que en el panel del admin.
  assert.deepEqual(de('quote.findMany').where.status, { not: 'draft' });

  // Control: la del admin SÍ consulta facturas. Si no, «no consulta facturas» no distinguiría nada.
  const admin = await pedir('admin', RUTA_DEL_ADMIN);
  assert.ok(admin.base.some((l) => l.op === 'invoice.findMany'), '🔴 CIEGO: el panel del admin tampoco consulta facturas');
});

test('SCRUM-1341 · el orden está DECLARADO en la consulta, y no depende de nada que se cuente', async () => {
  const r = await pedir('tecnico', RUTA_NUEVA);
  const miembros = r.base.find((l) => l.op === 'teamMember.findMany').args;
  assert.deepEqual(miembros.orderBy, { id: 'asc' }, '🔴 la consulta de miembros no lleva su `orderBy` escrito: un orden sin declarar puede cambiar solo');
  assert.deepEqual(r.cuerpo.members.map((m) => m.name), ['Dueña SL', 'Ana', 'Blas', 'Caro', 'Dani'],
    '🔴 las filas no salen con el propietario primero y los miembros como los trae la consulta');

  // Control: la consulta del admin NO lo lleva — es el hueco que la ruta nueva no hereda.
  const admin = await pedir('admin', RUTA_DEL_ADMIN);
  assert.equal(admin.base.find((l) => l.op === 'teamMember.findMany').args.orderBy, undefined,
    '🔴 la consulta del admin ha cambiado: revisa si este control sigue distinguiendo algo');
});

// ── ③ LO QUE SE CUENTA ES LO MISMO QUE VE EL ADMIN ───────────────────────────────────────────

test('SCRUM-1341 · ✅ persona a persona, la actividad del Técnico es la MISMA que ve el admin (las dos copias del recuento no divergen)', async () => {
  facturasCobradas = ESCENARIOS['B · Ana 900,41 · Blas 100,37 · suelto 50,13'];
  const tecnico = (await pedir('tecnico', RUTA_NUEVA)).cuerpo;
  const admin = (await pedir('admin', RUTA_DEL_ADMIN)).cuerpo;
  const sinDinero = (m) => ({ name: m.name, role: m.role, status: m.status, sent: m.sent, accepted: m.accepted, acceptanceRate: m.acceptanceRate, thisWeek: m.thisWeek });
  assert.deepEqual(tecnico.members, admin.members.map(sinDinero),
    '🔴 el recuento de actividad del Técnico no coincide con el del panel del admin');
  assert.equal(tecnico.hasTeam, admin.hasTeam);

  // Que no sea igualdad sobre el vacío: el recuento cuenta de verdad.
  const ana = tecnico.members.find((m) => m.name === 'Ana');
  assert.deepEqual([ana.sent, ana.accepted, ana.acceptanceRate, ana.thisWeek], [3, 2, 67, 3]);
  const caro = tecnico.members.find((m) => m.name === 'Caro');
  assert.deepEqual([caro.sent, caro.accepted, caro.acceptanceRate, caro.thisWeek], [1, 0, 0, 0]);
  assert.equal(tecnico.members[0].role, 'owner');
});

// ── ④ LA PANTALLA ────────────────────────────────────────────────────────────────────────────

const respirar = async () => { for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r)); };

/**
 * Lo que contestaría la ruta del ADMIN, con todo su dinero. La red del banco se lo contesta
 * TAMBIÉN a la ruta del Técnico, a propósito: el servidor no lo hace (caso de arriba), pero el
 * bloque del Técnico tiene que pintar por lista cerrada aunque le llegue de más.
 */
const CON_DINERO = {
  hasTeam: true,
  members: [
    { id: null, name: 'Dueña SL', role: 'owner', status: 'active', sent: 1, accepted: 1, collected: 300.29, acceptanceRate: 100, thisWeek: 1, isBest: false },
    { id: 11, name: 'Ana', role: 'tecnico', status: 'active', sent: 3, accepted: 2, collected: 900.41, acceptanceRate: 67, thisWeek: 3, isBest: true },
    { id: 13, name: 'Caro', role: 'tecnico', status: 'active', sent: 1, accepted: 0, collected: 0, acceptanceRate: 0, thisWeek: 0, isBest: false },
  ],
  inactive: ['Caro'],
  sinAsignar: { label: 'Sin asignar', collected: 50.13 },
  totalCollected: 1250.83,
};

async function montarInicio(rol, equipo = CON_DINERO) {
  const peticiones = [];
  const fetch = async (url, opts) => {
    const u = String(url);
    peticiones.push(`${(opts && opts.method) || 'GET'} ${u.replace(/\?.*$/, '')}`);
    let cuerpo = [];
    if (/\/admin\/metrics\/(home|inicio)$/.test(u)) cuerpo = { pendingCount: 0, quotesAwaiting: 0, pendingRequests: 0, weekly: {}, sparkline: [], recentActivity: [] };
    else if (/\/admin\/metrics\/(team|actividad-equipo)$/.test(u)) cuerpo = equipo;
    else if (/\/admin\/merchant/.test(u)) cuerpo = { id: 1, name: 'Taller', defaultCurrency: 'EUR', country: 'ES' };
    return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => cuerpo, text: async () => '' };
  };
  const b = cargarDashboard(RAIZ, {
    rol,
    red: { navigator: { userAgent: 'banco', language: 'es-ES', onLine: true, serviceWorker: { register: async () => ({}) } }, fetch },
  });
  b.ctx.appMerchantId = 1;
  b.ctx.appDocumentoSuelto = 'no';
  b.ctx.renderAppView = () => {};
  for (const id of ['req-badge', 'nav-quotes-badge', 'nav-invoices-badge']) {
    const g = b.mk('span');
    g.id = id;
    b.ctx.document.body.appendChild(g);
  }
  const v = await pintarVista(b, 'renderHomeView');
  assert.equal(v.error, null, `🔴 SUELO: el Inicio no monta con rol ${rol}: ${v.error && v.error.message}`);
  assert.equal(v.noMedida, null, `🔴 SUELO: ${v.noMedida}`);
  await respirar();
  const nodos = todos(v.contenedor);
  // El bloque del equipo: el nodo MÁS PROFUNDO cuyo marcado lleva las tres cabeceras.
  const conTabla = nodos.filter((n) => /<th[^>]*>Miembro<\/th>/.test(String(n.innerHTML || '')));
  return { peticiones, marcadoDelEquipo: conTabla.length ? String(conTabla[conTabla.length - 1].innerHTML) : null, bloqueDelTecnico: v.contenedor.querySelector('.equipo-actividad') };
}

/** Lo que el Técnico no ve. Cada uno se comprueba PRESENTE en el panel del admin con los mismos datos. */
const SOLO_DEL_ADMIN = [
  'Rendimiento del equipo',
  'Cobrado',
  'Total cobrado',
  'Sin asignar',
  'Cobros sin presupuesto',
  'Mejor del mes',
  '⭐',
  'Sin actividad esta semana',
  'Ver equipo',
  '900,41',
  '1250,83',
  '1.250,83',
  '50,13',
  '€',
];

test('SCRUM-1341 · ✅ el Inicio del TÉCNICO pinta «Actividad del equipo» con su ruta, el título firmado y tres columnas', async () => {
  const m = await montarInicio('tecnico');
  assert.ok(m.peticiones.includes(`GET ${RUTA_NUEVA}`), `🔴 el Inicio del Técnico no pide su ruta. Pidió: ${m.peticiones.join(', ')}`);
  assert.deepEqual(m.peticiones.filter((p) => p === `GET ${RUTA_DEL_ADMIN}`), [], '🔴 el Inicio del Técnico pide la ruta que le contesta 403');
  assert.ok(m.bloqueDelTecnico, '🔴 el bloque del Técnico no se pinta');

  const marcado = String(m.bloqueDelTecnico.innerHTML);
  assert.ok(marcado.includes(`>${TITULO_FIRMADO}<`), '🔴 el título no es, letra a letra, el que firmó el fundador');
  const cabeceras = [...marcado.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((x) => x[1]);
  assert.deepEqual(cabeceras, ['Miembro', 'Cotizaciones', 'Aceptación'], '🔴 las cabeceras no son las tres reusadas, en su orden');
  const filas = [...marcado.matchAll(/<tr>\s*<td[^>]*>([^<]*)<div[^>]*>([^<]*)<\/div><\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<\/tr>/g)].map((x) => x.slice(1, 5));
  assert.deepEqual(filas, [
    ['Dueña SL', 'Propietario', '1', '100%'],
    ['Ana', 'Operario', '3', '67%'],
    ['Caro', 'Operario', '1', '0%'],
  ], '🔴 las filas no llevan nombre, rol, enviados y % de aceptación, y nada más');
  assert.equal([...marcado.matchAll(/<button/g)].length, 0, '🔴 el bloque del Técnico lleva un botón');
  assert.equal([...marcado.matchAll(/style=/g)].length, 0, '🔴 el bloque del Técnico lleva estilos en línea (regla 4)');
});

test('SCRUM-1341 · 🔴 aunque le LLEGUE el dinero, el bloque del Técnico no pinta ni un importe, ni la estrella, ni el aviso, ni el botón', async () => {
  const tecnico = await montarInicio('tecnico');
  const admin = await montarInicio('admin');
  assert.ok(tecnico.marcadoDelEquipo && admin.marcadoDelEquipo, '🔴 CIEGO: falta el bloque del equipo en uno de los dos Inicios');

  // Control, PRIMERO: con los MISMOS datos, el admin sí ve cada una de estas cosas.
  const ausentesEnAdmin = SOLO_DEL_ADMIN.filter((t) => t !== '1250,83' && admin.marcadoDelEquipo.indexOf(t) < 0);
  assert.deepEqual(ausentesEnAdmin, [], `🔴 CIEGO: el panel del admin no pinta ${ausentesEnAdmin.join(' · ')}; la lista no mide nada`);

  const pintadosAlTecnico = SOLO_DEL_ADMIN.filter((t) => tecnico.marcadoDelEquipo.indexOf(t) >= 0);
  assert.deepEqual(pintadosAlTecnico, [], `\n🔴 EL TÉCNICO VE LO QUE ES DEL ADMIN: ${pintadosAlTecnico.join(' · ')}\n`);
});

test('SCRUM-1341 · ✅ el Inicio del ADMIN sigue siendo el de siempre: su ruta, su título, sus cuatro columnas y su dinero', async () => {
  const m = await montarInicio('admin');
  assert.ok(m.peticiones.includes(`GET ${RUTA_DEL_ADMIN}`), '🔴 el Inicio del admin ya no pide su panel del equipo');
  assert.deepEqual(m.peticiones.filter((p) => p === `GET ${RUTA_NUEVA}`), [], '🔴 el Inicio del admin pide la ruta del Técnico');
  assert.equal(m.bloqueDelTecnico, null, '🔴 al admin se le pinta el bloque del Técnico');

  const cabeceras = [...m.marcadoDelEquipo.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((x) => x[1]);
  assert.deepEqual(cabeceras, ['Miembro', 'Cotizaciones', 'Aceptación', 'Cobrado'], '🔴 al admin le ha cambiado la tabla');
  assert.ok(m.marcadoDelEquipo.includes('>Rendimiento del equipo · este mes<'), '🔴 al admin le ha cambiado el título');
  assert.ok(m.marcadoDelEquipo.includes('Ver equipo →'), '🔴 el admin pierde el botón al hub del equipo');
  assert.equal(m.marcadoDelEquipo.includes(TITULO_FIRMADO), false, '🔴 al admin se le pinta el título del Técnico');
});

test('SCRUM-1341 · sin equipo de campo no se pinta nada: ni una tabla vacía ni el título suelto', async () => {
  const m = await montarInicio('tecnico', { hasTeam: false, members: [{ name: 'Dueña SL', role: 'owner', status: 'active', sent: 0, accepted: 0, acceptanceRate: 0, thisWeek: 0 }] });
  assert.ok(m.peticiones.includes(`GET ${RUTA_NUEVA}`), '🔴 CIEGO: el Inicio no llegó a pedir la ruta');
  assert.equal(m.bloqueDelTecnico, null, '🔴 se pinta el bloque sin equipo');
});
