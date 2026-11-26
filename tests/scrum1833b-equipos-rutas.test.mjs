// SCRUM-1833b · rutas CRUD de los equipos del cliente, por la RUTA real con el doble de la casa.
// Decisiones del fundador: SCRUM-1833 c.22811 (P3 ❌ sin sitio, P4 ✅ borrar solo admin). Diseño: c.22817.
// Primera trampa, la de c.22817: el doble ejecuta `$transaction(cb)` como `cb(tx)` sobre LOS MISMOS modelos, así
// que no distingue si hay transacción. Aquí se envuelve: foto de las tablas y, si algo lanza, se
// restaura. Sin transacción en el código, el fallo sembrado deja los 4 documentos a NULL y el caso cae.
// Segunda trampa: `meta-mutaciones` corre SIN base, así que cada mutación la caza un caso de este fichero, sin gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const requiere = createRequire(import.meta.url);

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin el comercio en el `where`, B edita el equipo de A conociendo los dos números.
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '    where: { id: equipoId, merchantId, customerId },\n    data: columnasDelEquipo(datos),',
    a: '    where: { id: equipoId, customerId },\n    data: columnasDelEquipo(datos),',
    cae: 'tenencia: el comercio B recibe 404',
  },
  {
    // Sin la transacción, un borrado que falla deja los 4 documentos desligados de un equipo que sigue.
    fichero: 'src/modules/system/customerAdmin.ts',
    de: 'return prisma.$transaction((tx) => desligarYBorrarEquipo(tx as any, merchantId, customerId, equipoId));',
    a: 'return desligarYBorrarEquipo(prisma as any, merchantId, customerId, equipoId);',
    cae: 'borrar es atómico',
  },
  {
    // Sin el rol en la ruta, el técnico borra un equipo (P4 ✅: solo admin).
    fichero: 'src/modules/system/app/routes/customersAdmin.routes.ts',
    de: "router.delete('/:id/equipos/:equipoId', requireRole('admin'), async (req, res) => {",
    a: "router.delete('/:id/equipos/:equipoId', async (req, res) => {",
    cae: 'el técnico ve, crea y edita, pero NO borra',
  },
  {
    // Con `z.object`, un `customerSiteId` en el cuerpo se descarta en silencio en vez de dar 400 (P3 ❌).
    fichero: 'src/modules/system/customerAdmin.ts',
    de: 'export const equipoCreateSchema = z.strictObject({',
    a: 'export const equipoCreateSchema = z.object({',
    cae: 'obligatorios y campos prohibidos',
  },
  {
    // Sin el borrado de sus equipos, borrar un cliente que los tenga choca con la FK RESTRICT (c.22828 ②).
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '  for (const e of equipos) await desligarYBorrarEquipo(tx, merchantId, id, e.id);\n',
    a: '',
    cae: 'borrar el cliente se lleva sus equipos',
  },
];

const A = 7, B = 8, CLI_A = 31, CLI_B = 32;
const DOCS = ['job', 'maintenancePlan', 'albaran', 'parteTrabajo'];
let db = {};
let siguienteId = 100;

const casa = (fila, where = {}) => Object.entries(where).every(([k, v]) => fila[k] === v);
const proyecta = (fila, select) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, fila[k] ?? null])) : fila);

function tabla(nombre) {
  return {
    [`${nombre}.findFirst`]: ({ where, select }) => { const f = db[nombre].find((x) => casa(x, where)); return f ? proyecta(f, select) : null; },
    [`${nombre}.findMany`]: ({ where, select }) => db[nombre].filter((x) => casa(x, where)).map((f) => proyecta(f, select)),
    [`${nombre}.create`]: ({ data, select }) => {
      const fila = { id: siguienteId++, createdAt: new Date(), updatedAt: new Date(), brand: null, modelName: null, serialNumber: null, installedOn: null, warrantyUntil: null, ...data };
      db[nombre].push(fila);
      return proyecta(fila, select);
    },
    [`${nombre}.updateMany`]: ({ where, data }) => {
      const filas = db[nombre].filter((x) => casa(x, where));
      for (const f of filas) for (const [k, v] of Object.entries(data)) if (v !== undefined) f[k] = v;
      return { count: filas.length };
    },
    [`${nombre}.deleteMany`]: ({ where }) => {
      const filas = db[nombre].filter((x) => casa(x, where));
      if (filas.some((f) => f.falla)) throw new Error('fallo sembrado en el borrado del equipo');
      // La FK RESTRICT de `equipments.customer_id` (`docs/sql/scrum-914-equipos-del-cliente.sql:107`):
      // en Postgres, borrar un cliente que aún tiene equipos lanza. El doble lo imita.
      if (nombre === 'customer' && db.equipment.some((e) => filas.some((c) => c.id === e.customerId))) {
        throw new Error('FK RESTRICT: equipments.customer_id');
      }
      db[nombre] = db[nombre].filter((x) => !casa(x, where));
      return { count: filas.length };
    },
  };
}

const respuestas = Object.assign({}, ...['customer', 'equipment', 'attachment', ...DOCS].map(tabla));
inyectarBase(respuestas, ['../dist/modules/system/customerAdmin.js', '../dist/modules/system/app/routes/customersAdmin.routes.js']);

// Primera trampa: la transacción de verdad es «todo o nada». La foto se restaura si el callback lanza.
const modPrisma = requiere.cache[requiere.resolve('../dist/core/db/prisma.js')].exports;
const doble = modPrisma.prisma;
modPrisma.prisma = new Proxy(doble, {
  get: (t, p) => (p !== '$transaction' ? t[p] : async (cb) => {
    const foto = structuredClone(db);
    try { return await t.$transaction(cb); } catch (e) { db = foto; throw e; }
  }),
});

const express = requiere('express');
const router = moduloDeDist('../dist/modules/system/app/routes/customersAdmin.routes.js').default;
const { TECNICO_ALLOWED } = moduloDeDist('../dist/core/http/adminRouteDeclarations.js');

function sembrar() {
  siguienteId = 100;
  db = {
    customer: [{ id: CLI_A, merchantId: A }, { id: CLI_B, merchantId: B }],
    equipment: [
      { id: 1, merchantId: A, customerId: CLI_A, type: 'Caldera', name: 'Caldera cocina', brand: 'Saunier', installedOn: new Date('2024-03-01T00:00:00Z'), warrantyUntil: null },
      { id: 2, merchantId: B, customerId: CLI_B, type: 'Aire', name: 'Split salón' },
      { id: 3, merchantId: A, customerId: CLI_A, type: 'Bomba', name: 'Bomba pozo', falla: true },
    ],
  };
  for (const t of DOCS) {
    db[t] = [
      { id: 1, merchantId: A, equipmentId: 1 }, // el documento de A que nombra al equipo 1
      { id: 2, merchantId: B, equipmentId: 1 }, // 🔴 de B, con el MISMO número: solo el `merchantId` lo separa
      { id: 3, merchantId: A, equipmentId: 3 }, // nombra al equipo cuyo borrado falla
    ];
  }
}

async function pedir(metodo, ruta, { cuerpo, merchantId = A, rol = 'admin' } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { Object.assign(req, reqDeSesion({ rol, merchantId })); next(); });
  app.use('/admin/customers', router);
  const srv = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  const callar = console.error; console.error = () => {};
  try {
    const datos = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
    return await new Promise((ok, ko) => {
      const pet = http.request({ host: '127.0.0.1', port: srv.address().port, path: ruta, method: metodo,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(datos) } }, (res) => {
        const trozos = [];
        res.on('data', (c) => trozos.push(c));
        res.on('end', () => { const t = Buffer.concat(trozos).toString('utf8'); ok({ status: res.statusCode, json: t ? JSON.parse(t) : undefined }); });
      });
      pet.on('error', ko);
      pet.end(datos);
    });
  } finally {
    console.error = callar;
    await new Promise((ok) => srv.close(ok));
  }
}

const ligados = (equipoId) => DOCS.map((t) => db[t].filter((d) => d.merchantId === A && d.equipmentId === equipoId).length);

test('SCRUM-1833b · ✅ control del banco: el dueño ve su equipo sembrado, con la fecha como YYYY-MM-DD (positivo)', async () => {
  sembrar();
  const r = await pedir('GET', `/admin/customers/${CLI_A}/equipos`);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.equipos.map((e) => e.id), [1, 3]);
  assert.equal(r.json.equipos[0].installedOn, '2024-03-01');
});

test('SCRUM-1833b · 🔴 tenencia: el comercio B recibe 404 con el cliente y el equipo de A, y no cambia nada', async () => {
  sembrar();
  const como = { merchantId: B };
  assert.equal((await pedir('GET', `/admin/customers/${CLI_A}/equipos`, como)).status, 404);
  assert.equal((await pedir('POST', `/admin/customers/${CLI_A}/equipos`, { ...como, cuerpo: { type: 'X', name: 'Y' } })).status, 404);
  assert.equal((await pedir('PUT', `/admin/customers/${CLI_A}/equipos/1`, { ...como, cuerpo: { name: 'Robado' } })).status, 404);
  assert.equal((await pedir('DELETE', `/admin/customers/${CLI_A}/equipos/1`, como)).status, 404);
  assert.equal(db.equipment.find((e) => e.id === 1).name, 'Caldera cocina', 'el equipo de A no se ha tocado');
  assert.deepEqual(ligados(1), [1, 1, 1, 1], 'sus documentos siguen ligados');
});

test('SCRUM-1833b · obligatorios y campos prohibidos: 400 invalid_body / invalid_id; los opcionales vacíos quedan a null', async () => {
  sembrar();
  const alta = (cuerpo) => pedir('POST', `/admin/customers/${CLI_A}/equipos`, { cuerpo });
  for (const malo of [
    { name: 'Sin tipo' },
    { type: '   ', name: 'Tipo en blanco' },
    { type: 'Caldera', name: 'x'.repeat(201) },
    { type: 'Caldera', name: 'Con sitio', customerSiteId: 5 }, // P3 ❌
    { type: 'Caldera', name: 'Con comercio', merchantId: B },
    { type: 'Caldera', name: 'Día que no existe', installedOn: '2026-02-30' },
    { type: 'Caldera', name: 'Otra forma', warrantyUntil: '01/03/2026' },
  ]) {
    const r = await alta(malo);
    assert.equal(r.status, 400, `debió dar 400: ${JSON.stringify(malo)}`);
    assert.equal(r.json.error, 'invalid_body');
  }
  assert.equal((await pedir('PUT', `/admin/customers/${CLI_A}/equipos/1`, { cuerpo: { customerSiteId: 5 } })).status, 400);
  assert.equal((await pedir('GET', '/admin/customers/abc/equipos')).json.error, 'invalid_id');
  assert.equal(db.equipment.length, 3, 'ningún 400 ha creado nada');
  const bueno = await alta({ type: ' Caldera ', name: 'Caldera baño', brand: '', installedOn: '2025-06-15', warrantyUntil: '' });
  assert.equal(bueno.status, 201);
  assert.equal(bueno.json.equipo.type, 'Caldera');
  assert.equal(bueno.json.equipo.brand, null);
  assert.equal(bueno.json.equipo.installedOn, '2025-06-15');
  assert.equal(bueno.json.equipo.warrantyUntil, null);
});

test('SCRUM-1833b · 🔴 permisos: el técnico ve, crea y edita, pero NO borra (403), y el equipo sigue', async () => {
  sembrar();
  const tec = { rol: 'tecnico' };
  assert.equal((await pedir('GET', `/admin/customers/${CLI_A}/equipos`, tec)).status, 200);
  assert.equal((await pedir('POST', `/admin/customers/${CLI_A}/equipos`, { ...tec, cuerpo: { type: 'Aire', name: 'Split' } })).status, 201);
  assert.equal((await pedir('PUT', `/admin/customers/${CLI_A}/equipos/1`, { ...tec, cuerpo: { serialNumber: 'SN-1' } })).status, 200);
  assert.equal((await pedir('DELETE', `/admin/customers/${CLI_A}/equipos/1`, tec)).status, 403);
  assert.ok(db.equipment.some((e) => e.id === 1), 'tras el 403, el equipo sigue');
  assert.equal((await pedir('DELETE', `/admin/customers/${CLI_A}/equipos/1`)).status, 204, 'el admin SÍ (positivo del mismo camino)');
  const decl = (m, p) => TECNICO_ALLOWED.some((d) => d.method === m && d.path === p);
  assert.ok(decl('GET', '/admin/customers/:id/equipos') && decl('POST', '/admin/customers/:id/equipos') && decl('PUT', '/admin/customers/:id/equipos/:equipoId'));
  assert.equal(decl('DELETE', '/admin/customers/:id/equipos/:equipoId'), false, 'el DELETE no se declara para el técnico');
});

test('SCRUM-1833b · borrar un equipo desliga los 4 documentos de ESE comercio y nada más', async () => {
  sembrar();
  assert.deepEqual(ligados(1), [1, 1, 1, 1]);
  assert.equal((await pedir('DELETE', `/admin/customers/${CLI_A}/equipos/1`)).status, 204);
  assert.ok(!db.equipment.some((e) => e.id === 1));
  assert.deepEqual(ligados(1), [0, 0, 0, 0], 'trabajo, plan, albarán y parte de A quedan a NULL');
  for (const t of DOCS) {
    assert.equal(db[t].find((d) => d.merchantId === B).equipmentId, 1, `${t} de B no se toca`);
    assert.equal(db[t].find((d) => d.id === 1).equipmentId, null);
  }
});

test('SCRUM-1833b · 🔴 borrar es atómico: si el borrado del equipo falla, los 4 documentos siguen ligados', async () => {
  sembrar();
  assert.deepEqual(ligados(3), [1, 1, 1, 1]);
  const r = await pedir('DELETE', `/admin/customers/${CLI_A}/equipos/3`);
  assert.equal(r.status, 500);
  assert.equal(r.json.error, 'internal_error');
  assert.ok(db.equipment.some((e) => e.id === 3), 'el equipo sigue');
  assert.deepEqual(ligados(3), [1, 1, 1, 1], 'y sus 4 documentos siguen ligados: o todo o nada');
});

test('SCRUM-1833b · 🔴 borrar el cliente se lleva sus equipos y desliga sus documentos; el equipo de B, intacto (c.22828 ②)', async () => {
  const { deleteCustomer } = moduloDeDist('../dist/modules/system/customerAdmin.js');
  db = {
    customer: [{ id: CLI_A, merchantId: A }, { id: CLI_B, merchantId: B }],
    equipment: [
      { id: 1, merchantId: A, customerId: CLI_A, type: 'Caldera', name: 'Caldera cocina' },
      { id: 4, merchantId: A, customerId: CLI_A, type: 'Aire', name: 'Split dormitorio' },
      { id: 2, merchantId: B, customerId: CLI_B, type: 'Aire', name: 'Split salón' },
    ],
    job: [{ id: 1, merchantId: A, equipmentId: 1 }],
    albaran: [{ id: 1, merchantId: A, equipmentId: 1 }],
    maintenancePlan: [],
    parteTrabajo: [],
    attachment: [],
  };
  const r = await deleteCustomer(A, CLI_A);
  assert.equal(r.count, 1, 'el cliente se borra');
  assert.ok(!db.customer.some((c) => c.id === CLI_A));
  assert.deepEqual(db.equipment.filter((e) => e.customerId === CLI_A), [], 'sus 2 equipos se van con él');
  assert.equal(db.job[0].equipmentId, null, 'el trabajo queda sin equipo');
  assert.equal(db.albaran[0].equipmentId, null, 'el albarán queda sin equipo');
  assert.deepEqual(db.equipment.map((e) => e.id), [2], 'el equipo del comercio B, intacto');
});
