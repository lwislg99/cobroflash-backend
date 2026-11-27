// SCRUM-1868a · borrar un cliente, por la RUTA real con el doble de la casa (A10, SCRUM-1344: el handler
// suelto no vale). Decisión del fundador: SCRUM-1868 (descripción y c.22850). BLOQUEAN `Quote` e
// `Invoice` (409 con motivo); SE BORRAN en la transacción sitios, equipos, documentos, historial y
// solicitudes; `Charge.customerId` es opcional y se queda (la base lo pone a NULL).
// Primera trampa (la de 1833b): el doble ejecuta `$transaction(cb)` como `cb(tx)` sobre LOS MISMOS
// modelos, así que no distingue si hay transacción. Se envuelve: foto de las tablas y, si algo lanza,
// se restaura. Sin transacción en el código, el fallo sembrado deja medio cliente borrado y el caso cae.
// Segunda trampa: el doble imita las FK RESTRICT de las cinco tablas y la de los equipos; sin eso, un
// borrado que se olvida una tabla saldría 204 aquí y 500 en Postgres.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const requiere = createRequire(import.meta.url);

export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // Sin el bloqueo, un cliente con presupuestos choca con la FK RESTRICT de `quotes`: 500, no 409.
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '  if (motivos.length > 0) throw new BorradoBloqueado(motivos, cuenta);\n',
    a: '',
    cae: 'con un presupuesto, el DELETE da 409 tiene_presupuestos',
  },
  {
    // Sin la transacción, un fallo a mitad deja el cliente sin sitios ni historial y la ficha viva.
    fichero: 'src/modules/system/customerAdmin.ts',
    de: 'return prisma.$transaction((tx) => borrarClienteYSusDocumentos(tx as any, merchantId, id));',
    a: 'return borrarClienteYSusDocumentos(prisma as any, merchantId, id);',
    cae: 'un fallo a mitad no deja nada a medias',
  },
  {
    // Sin borrar sus solicitudes, la FK RESTRICT de `quote_requests` tumba el borrado (c.22850: se borran).
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '  await tx.quoteRequest.deleteMany({ where: { merchantId, customerId: id } });\n',
    a: '',
    cae: 'sin presupuestos ni facturas, el DELETE da 204',
  },
  {
    // Sin el comercio en el contador, el presupuesto de OTRO comercio con el mismo número bloquea (regla 2).
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '  const delCliente = { where: { merchantId, customerId: id } };',
    a: '  const delCliente = { where: { customerId: id } };',
    cae: 'sin presupuestos ni facturas, el DELETE da 204',
  },
  {
    // Sin comprobar antes que el cliente es del comercio, B borra las filas de A que llevan su número.
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '  if (!cliente) return { count: 0 };\n',
    a: '',
    cae: 'tenencia: el comercio B recibe 404 y no toca ninguna fila',
  },
  {
    // Sin el rol, el técnico lee qué tiene el cliente antes de que un admin lo borre (SCRUM-55 D2).
    fichero: 'src/modules/system/app/routes/customersAdmin.routes.ts',
    de: "router.get('/:id/borrado-previa', requireRole('admin'), async (req, res) => {",
    a: "router.get('/:id/borrado-previa', async (req, res) => {",
    cae: 'permisos: el técnico recibe 403 en la previa y en el borrado',
  },
  {
    // SCRUM-1868d · sin contar sus trabajos, el cliente se borra y el trabajo queda apuntando a nadie (sin FK).
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '    trabajos: await tx.job.count(delCliente),\n',
    a: '    trabajos: 0,\n',
    cae: 'SCRUM-1868d · 🔴 con un trabajo, el DELETE da 409 tiene_trabajos y no borra nada',
  },
  {
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '    partes: await tx.parteTrabajo.count(delCliente),\n',
    a: '    partes: 0,\n',
    cae: 'SCRUM-1868d · 🔴 con un parte, el DELETE da 409 tiene_partes y no borra nada',
  },
  {
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '    mantenimientos: await tx.maintenancePlan.count(delCliente),\n',
    a: '    mantenimientos: 0,\n',
    cae: 'SCRUM-1868d · 🔴 con un plan de mantenimiento, el DELETE da 409 tiene_mantenimientos y no borra nada',
  },
  {
    // Sin el desligue, el mensaje se queda con el número de un cliente que ya no existe (b3, c.22916).
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '  await tx.whatsAppMessage.updateMany({ where: { merchantId, customerId: id }, data: { customerId: null } });\n',
    a: '',
    cae: 'SCRUM-1868d · 🔴 con solo mensajes, el DELETE da 204 y sus dos mensajes siguen, desligados y con su teléfono y su correo',
  },
  {
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '  await tx.emailMessage.updateMany({ where: { merchantId, customerId: id }, data: { customerId: null } });\n',
    a: '',
    cae: 'SCRUM-1868d · 🔴 con solo mensajes, el DELETE da 204 y sus dos mensajes siguen, desligados y con su teléfono y su correo',
  },
  {
    // Sin el comercio en el desligue, se desligan los mensajes de B que llevan el mismo número de cliente (regla 2).
    fichero: 'src/modules/system/customerAdmin.ts',
    de: '  await tx.whatsAppMessage.updateMany({ where: { merchantId, customerId: id }',
    a: '  await tx.whatsAppMessage.updateMany({ where: { customerId: id }',
    cae: 'SCRUM-1868d · 🔴 tenencia de los mensajes: los de B con el mismo número de cliente y los de otro cliente de A no se tocan',
  },
];

const A = 7, B = 8, CLI_A = 31, CLI_B = 32;
// Las tablas que apuntan a `customers` sin `onDelete` (RESTRICT): las cinco del ticket y la de los equipos.
const RESTRICT = ['equipment', 'customerSite', 'customerEvent', 'quoteRequest', 'quote', 'invoice'];
const DOCS = ['job', 'maintenancePlan', 'albaran', 'parteTrabajo'];
// SCRUM-1868d · c.22916: `job`, `parteTrabajo` y `maintenancePlan` apuntan al cliente SIN FK (el doble no
// puede imitar un RESTRICT que la base no tiene: si el código no bloquea, aquí sale 204 con el huérfano
// dentro). Los mensajes tampoco tienen FK: se desligan (`customerId` a NULL) y la fila se queda.
const MENSAJES = ['whatsAppMessage', 'emailMessage'];
const CLI_OTRO = 33; // otro cliente del comercio A: sus mensajes no se tocan
const TABLAS = ['customer', 'attachment', 'charge', ...RESTRICT, ...DOCS, ...MENSAJES];
let db = {};

const casa = (fila, where = {}) => Object.entries(where).every(([k, v]) => fila[k] === v);
const proyecta = (fila, select) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, fila[k] ?? null])) : fila);
// Una fila de otro comercio con el MISMO número de cliente sólo la separa el `merchantId`: la FK del
// doble mira los dos, para que esas filas trampa no bloqueen y sí delaten un `where` sin comercio.
const esDe = (fila, c) => fila.customerId === c.id && fila.merchantId === c.merchantId;

function tabla(nombre) {
  return {
    [`${nombre}.findFirst`]: ({ where, select }) => { const f = db[nombre].find((x) => casa(x, where)); return f ? proyecta(f, select) : null; },
    [`${nombre}.findMany`]: ({ where, select }) => db[nombre].filter((x) => casa(x, where)).map((f) => proyecta(f, select)),
    [`${nombre}.count`]: ({ where }) => db[nombre].filter((x) => casa(x, where)).length,
    [`${nombre}.updateMany`]: ({ where, data }) => {
      const filas = db[nombre].filter((x) => casa(x, where));
      for (const f of filas) for (const [k, v] of Object.entries(data)) if (v !== undefined) f[k] = v;
      return { count: filas.length };
    },
    [`${nombre}.deleteMany`]: ({ where }) => {
      const filas = db[nombre].filter((x) => casa(x, where));
      if (filas.some((f) => f.falla)) throw new Error(`fallo sembrado en el borrado de ${nombre}`);
      if (nombre === 'customer') {
        for (const c of filas) {
          for (const t of RESTRICT) if (db[t].some((r) => esDe(r, c))) throw new Error(`FK RESTRICT: ${t}.customer_id`);
          for (const ch of db.charge) if (esDe(ch, c)) ch.customerId = null; // SET NULL: relación opcional
        }
      }
      db[nombre] = db[nombre].filter((x) => !casa(x, where));
      return { count: filas.length };
    },
  };
}

inyectarBase(Object.assign({}, ...TABLAS.map(tabla)), ['../dist/modules/system/customerAdmin.js', '../dist/modules/system/app/routes/customersAdmin.routes.js']);

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

/** El cliente de (c): 1 sitio, 2 equipos (uno colgado del sitio), 1 documento, 2 eventos y 1 solicitud. */
function sembrar({ presupuestos = 0, facturas = 0, trabajos = 0, partes = 0, mantenimientos = 0, mensajes = false } = {}) {
  const deA = (n, desde) => Array.from({ length: n }, (_, i) => ({ id: desde + i, merchantId: A, customerId: CLI_A }));
  db = {
    customer: [{ id: CLI_A, merchantId: A }, { id: CLI_B, merchantId: B }],
    customerSite: [
      { id: 1, merchantId: A, customerId: CLI_A },
      { id: 2, merchantId: B, customerId: CLI_A }, // 🔴 de B, con el MISMO número de cliente
    ],
    equipment: [
      { id: 1, merchantId: A, customerId: CLI_A, customerSiteId: 1 },
      { id: 2, merchantId: A, customerId: CLI_A, customerSiteId: null },
      { id: 3, merchantId: B, customerId: CLI_B, customerSiteId: null },
    ],
    attachment: [
      { id: 1, merchantId: A, entityType: 'customer', entityId: CLI_A, kind: 'document' },
      { id: 2, merchantId: B, entityType: 'customer', entityId: CLI_A, kind: 'document' }, // 🔴
    ],
    customerEvent: [
      { id: 1, merchantId: A, customerId: CLI_A },
      { id: 2, merchantId: A, customerId: CLI_A },
      { id: 3, merchantId: B, customerId: CLI_A }, // 🔴
    ],
    quoteRequest: [
      { id: 1, merchantId: A, customerId: CLI_A },
      { id: 2, merchantId: B, customerId: CLI_A }, // 🔴
    ],
    quote: [
      { id: 900, merchantId: B, customerId: CLI_A }, // 🔴 un presupuesto de B NO bloquea al cliente de A
      ...Array.from({ length: presupuestos }, (_, i) => ({ id: 1 + i, merchantId: A, customerId: CLI_A })),
    ],
    invoice: Array.from({ length: facturas }, (_, i) => ({ id: 1 + i, merchantId: A, customerId: CLI_A })),
    charge: [{ id: 1, merchantId: A, customerId: CLI_A }, { id: 2, merchantId: B, customerId: CLI_B }],
    // El trabajo 1 nombra al equipo y NO es del cliente (sin `customerId`): no bloquea. Los 900 son de B
    // con el MISMO número de cliente: tampoco bloquean, y delatan un contador sin comercio.
    job: [{ id: 1, merchantId: A, equipmentId: 1 }, { id: 900, merchantId: B, customerId: CLI_A }, ...deA(trabajos, 10)],
    maintenancePlan: [{ id: 900, merchantId: B, customerId: CLI_A }, ...deA(mantenimientos, 10)],
    albaran: [],
    parteTrabajo: [{ id: 900, merchantId: B, customerId: CLI_A }, ...deA(partes, 10)],
    whatsAppMessage: [
      { id: 900, merchantId: B, customerId: CLI_A, toPhone: '+34600000900' }, // 🔴 de B, mismo número de cliente
      { id: 901, merchantId: A, customerId: CLI_OTRO, toPhone: '+34600000901' }, // de A, de OTRO cliente
      ...(mensajes ? [{ id: 1, merchantId: A, customerId: CLI_A, toPhone: '+34600000001' }] : []),
    ],
    emailMessage: [
      { id: 900, merchantId: B, customerId: CLI_A, toEmail: 'b@ejemplo.test' }, // 🔴
      { id: 901, merchantId: A, customerId: CLI_OTRO, toEmail: 'otro@ejemplo.test' },
      ...(mensajes ? [{ id: 1, merchantId: A, customerId: CLI_A, toEmail: 'a@ejemplo.test' }] : []),
    ],
  };
}

async function pedir(metodo, ruta, { merchantId = A, rol = 'admin' } = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { Object.assign(req, reqDeSesion({ rol, merchantId })); next(); });
  app.use('/admin/customers', router);
  const srv = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  const callar = console.error; console.error = () => {};
  try {
    return await new Promise((ok, ko) => {
      const pet = http.request({ host: '127.0.0.1', port: srv.address().port, path: ruta, method: metodo, agent: false }, (res) => {
        const trozos = [];
        res.on('data', (c) => trozos.push(c));
        res.on('end', () => { const t = Buffer.concat(trozos).toString('utf8'); ok({ status: res.statusCode, json: t ? JSON.parse(t) : undefined }); });
      });
      pet.on('error', ko);
      pet.end();
    });
  } finally {
    console.error = callar;
    await new Promise((ok) => srv.close(ok));
  }
}

const borrar = (id = CLI_A, como) => pedir('DELETE', `/admin/customers/${id}`, como);
const previa = (id = CLI_A, como) => pedir('GET', `/admin/customers/${id}/borrado-previa`, como);
/** Filas del cliente de A en cada tabla (las trampas de B, con el mismo número, no cuentan). */
const filasDeA = () => ({
  customer: db.customer.filter((c) => c.id === CLI_A).length,
  customerSite: db.customerSite.filter((r) => r.merchantId === A && r.customerId === CLI_A).length,
  equipment: db.equipment.filter((r) => r.merchantId === A && r.customerId === CLI_A).length,
  attachment: db.attachment.filter((r) => r.merchantId === A && r.entityId === CLI_A).length,
  customerEvent: db.customerEvent.filter((r) => r.merchantId === A && r.customerId === CLI_A).length,
  quoteRequest: db.quoteRequest.filter((r) => r.merchantId === A && r.customerId === CLI_A).length,
  quote: db.quote.filter((r) => r.merchantId === A && r.customerId === CLI_A).length,
  invoice: db.invoice.filter((r) => r.merchantId === A && r.customerId === CLI_A).length,
});
/** SCRUM-1868d · lo mismo para las cinco tablas SIN FK: las tres que bloquean y las dos que se desligan. */
const sinFkDeA = () => Object.fromEntries(['job', 'parteTrabajo', 'maintenancePlan', ...MENSAJES]
  .map((t) => [t, db[t].filter((r) => r.merchantId === A && r.customerId === CLI_A).length]));
const CUENTA_DEL_SEMBRADO = {
  documentos: 1, sitios: 1, equipos: 2, historial: 2, solicitudes: 1, presupuestos: 0, facturas: 0,
  trabajos: 0, partes: 0, mantenimientos: 0,
};

test('SCRUM-1868a · ✅ control del banco: el sembrado tiene filas del cliente en las ocho tablas que mira el borrado (positivo)', () => {
  sembrar({ presupuestos: 1, facturas: 1 });
  assert.deepEqual(filasDeA(), { customer: 1, customerSite: 1, equipment: 2, attachment: 1, customerEvent: 2, quoteRequest: 1, quote: 1, invoice: 1 });
});

test('SCRUM-1868d · ✅ control del banco: con todo sembrado hay filas del cliente en las cinco tablas sin FK, y sin sembrar, ninguna (positivo y cero)', () => {
  sembrar({ trabajos: 1, partes: 1, mantenimientos: 1, mensajes: true });
  assert.deepEqual(sinFkDeA(), { job: 1, parteTrabajo: 1, maintenancePlan: 1, whatsAppMessage: 1, emailMessage: 1 });
  sembrar();
  assert.deepEqual(sinFkDeA(), { job: 0, parteTrabajo: 0, maintenancePlan: 0, whatsAppMessage: 0, emailMessage: 0 });
  // Las trampas (de B con el mismo número, y de otro cliente de A) están SIEMPRE: sin ellas, la tenencia no mide.
  assert.deepEqual(['job', 'parteTrabajo', 'maintenancePlan', ...MENSAJES].map((t) => db[t].filter((r) => r.merchantId === B && r.customerId === CLI_A).length), [1, 1, 1, 1, 1]);
  assert.deepEqual(MENSAJES.map((t) => db[t].filter((r) => r.merchantId === A && r.customerId === CLI_OTRO).length), [1, 1]);
});

test('SCRUM-1868a · 🔴 con un presupuesto, el DELETE da 409 tiene_presupuestos y no borra nada', async () => {
  sembrar({ presupuestos: 1 });
  const antes = structuredClone(db);
  const r = await borrar();
  assert.equal(r.status, 409, `hoy (main f336e00c2) da 500 por la FK RESTRICT de quotes; dio ${r.status}`);
  assert.deepEqual(r.json, { error: 'tiene_presupuestos', motivos: ['tiene_presupuestos'], cuenta: { ...CUENTA_DEL_SEMBRADO, presupuestos: 1 } });
  assert.deepEqual(db, antes, 'el 409 no toca ninguna fila');
});

test('SCRUM-1868a · 🔴 con una factura, 409 tiene_facturas; con las dos, el error es tiene_facturas y van los dos motivos', async () => {
  sembrar({ facturas: 1 });
  const antes = structuredClone(db);
  const r = await borrar();
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'tiene_facturas');
  assert.deepEqual(r.json.motivos, ['tiene_facturas']);
  assert.equal(r.json.cuenta.facturas, 1);
  assert.deepEqual(db, antes, 'una factura emitida jamás se borra (regla 29)');
  sembrar({ presupuestos: 2, facturas: 3 });
  const ambas = await borrar();
  assert.equal(ambas.status, 409);
  assert.deepEqual(ambas.json, { error: 'tiene_facturas', motivos: ['tiene_facturas', 'tiene_presupuestos'], cuenta: { ...CUENTA_DEL_SEMBRADO, presupuestos: 2, facturas: 3 } });
});

test('SCRUM-1868a · 🔴 sin presupuestos ni facturas, el DELETE da 204 y se lleva sitios, equipos, documentos, historial y solicitudes', async () => {
  sembrar();
  const r = await borrar();
  assert.equal(r.status, 204, `dio ${r.status} ${JSON.stringify(r.json)}`);
  assert.deepEqual(filasDeA(), { customer: 0, customerSite: 0, equipment: 0, attachment: 0, customerEvent: 0, quoteRequest: 0, quote: 0, invoice: 0 });
  assert.equal(db.job[0].equipmentId, null, 'el trabajo que nombraba al equipo queda sin equipo (1833b)');
  // Las trampas de B, con el mismo número de cliente, siguen: cada borrado lleva el comercio (regla 2).
  assert.deepEqual([db.customerSite, db.attachment, db.customerEvent, db.quoteRequest, db.quote].map((t) => t.filter((f) => f.merchantId === B).length), [1, 1, 1, 1, 1]);
  assert.deepEqual(db.customer.map((c) => c.id), [CLI_B]);
  assert.deepEqual(db.equipment.map((e) => e.id), [3], 'el equipo de B, intacto');
});

test('SCRUM-1868a · 🔴 un fallo a mitad no deja nada a medias: 500 y todas las tablas como estaban', async () => {
  sembrar();
  db.quoteRequest[0].falla = true; // falla DESPUÉS de equipos, sitios e historial
  const antes = structuredClone(db);
  const r = await borrar();
  assert.equal(r.status, 500);
  assert.equal(r.json.error, 'internal_error');
  assert.deepEqual(db, antes, 'o se va todo o no se va nada');
});

test('SCRUM-1868a · 🔴 tenencia: el comercio B recibe 404 y no toca ninguna fila, ni en el DELETE ni en la previa', async () => {
  sembrar({ presupuestos: 1 });
  const antes = structuredClone(db);
  const como = { merchantId: B };
  const r = await borrar(CLI_A, como);
  assert.equal(r.status, 404);
  assert.deepEqual(r.json, { error: 'not_found' }, 'ni un 409 que delate que el cliente de A tiene presupuestos');
  const p = await previa(CLI_A, como);
  assert.equal(p.status, 404);
  assert.deepEqual(p.json, { error: 'not_found' });
  assert.deepEqual(db, antes);
  assert.equal((await borrar(999)).status, 404, 'un cliente que no existe, también 404');
});

test('SCRUM-1868a · la previa cuenta exacto, dice bloqueado en los dos sentidos y no escribe', async () => {
  sembrar();
  const antes = structuredClone(db);
  const libre = await previa();
  assert.equal(libre.status, 200);
  assert.deepEqual(libre.json, { bloqueado: false, motivos: [], cuenta: CUENTA_DEL_SEMBRADO });
  assert.deepEqual(db, antes, 'la previa no escribe');
  sembrar({ presupuestos: 1, facturas: 2 });
  const bloqueada = await previa();
  assert.deepEqual(bloqueada.json, { bloqueado: true, motivos: ['tiene_facturas', 'tiene_presupuestos'], cuenta: { ...CUENTA_DEL_SEMBRADO, presupuestos: 1, facturas: 2 } });
  assert.equal((await pedir('GET', '/admin/customers/1.5/borrado-previa')).json.error, 'invalid_id');
});

test('SCRUM-1868a · 🔴 la previa y el DELETE no discrepan: mismo bloqueo, mismos motivos y misma cuenta', async () => {
  for (const caso of [{}, { presupuestos: 1 }, { facturas: 1 }, { presupuestos: 1, facturas: 1 }, { trabajos: 1 }, { partes: 1 }, { mantenimientos: 1 }, { mensajes: true }]) {
    sembrar(caso);
    const p = await previa();
    const d = await borrar();
    assert.equal(d.status === 409, p.json.bloqueado, `${JSON.stringify(caso)}: previa bloqueado=${p.json.bloqueado}, DELETE ${d.status}`);
    if (d.status === 409) assert.deepEqual({ motivos: d.json.motivos, cuenta: d.json.cuenta }, { motivos: p.json.motivos, cuenta: p.json.cuenta });
    else assert.equal(d.status, 204);
  }
});

test('SCRUM-1868a · el cobro del cliente se queda: no se borra y su customerId pasa a NULL (lo hace la base)', async () => {
  sembrar();
  assert.equal((await borrar()).status, 204);
  // El NULL lo pone el doble imitando a Postgres (relación opcional, SET NULL); lo que mide este caso es
  // que el código NO borra el cobro: `charge` no aparece en el borrado.
  assert.deepEqual(db.charge, [{ id: 1, merchantId: A, customerId: null }, { id: 2, merchantId: B, customerId: CLI_B }]);
});

// ── SCRUM-1868d · c.22916: bloquean también trabajos, partes y mantenimientos; los mensajes se desligan ──

async function bloqueaSinFk(clave, motivo) {
  sembrar({ [clave]: 1 });
  const antes = structuredClone(db);
  const r = await borrar();
  assert.equal(r.status, 409, `sin el bloqueo sale 204 y la fila queda apuntando a nadie; dio ${r.status}`);
  assert.deepEqual(r.json, { error: motivo, motivos: [motivo], cuenta: { ...CUENTA_DEL_SEMBRADO, [clave]: 1 } });
  assert.deepEqual(db, antes, 'el 409 no toca ninguna fila');
}

test('SCRUM-1868d · 🔴 con un trabajo, el DELETE da 409 tiene_trabajos y no borra nada', () => bloqueaSinFk('trabajos', 'tiene_trabajos'));
test('SCRUM-1868d · 🔴 con un parte, el DELETE da 409 tiene_partes y no borra nada', () => bloqueaSinFk('partes', 'tiene_partes'));
test('SCRUM-1868d · 🔴 con un plan de mantenimiento, el DELETE da 409 tiene_mantenimientos y no borra nada', () => bloqueaSinFk('mantenimientos', 'tiene_mantenimientos'));

test('SCRUM-1868d · 🔴 con factura, trabajo, parte y plan, los motivos van en el orden del contrato y el error es tiene_facturas', async () => {
  sembrar({ facturas: 1, presupuestos: 1, trabajos: 2, partes: 1, mantenimientos: 3 });
  const antes = structuredClone(db);
  const r = await borrar();
  assert.equal(r.status, 409);
  assert.deepEqual(r.json, {
    error: 'tiene_facturas',
    motivos: ['tiene_facturas', 'tiene_presupuestos', 'tiene_trabajos', 'tiene_partes', 'tiene_mantenimientos'],
    cuenta: { ...CUENTA_DEL_SEMBRADO, facturas: 1, presupuestos: 1, trabajos: 2, partes: 1, mantenimientos: 3 },
  });
  assert.deepEqual(db, antes);
  sembrar({ trabajos: 1, partes: 1, mantenimientos: 1 });
  const sinDocumentos = await borrar();
  assert.deepEqual([sinDocumentos.json.error, sinDocumentos.json.motivos], ['tiene_trabajos', ['tiene_trabajos', 'tiene_partes', 'tiene_mantenimientos']]);
});

test('SCRUM-1868d · 🔴 la previa con un trabajo dice bloqueado y tiene_trabajos, y no escribe', async () => {
  sembrar({ trabajos: 1 });
  const antes = structuredClone(db);
  const p = await previa();
  assert.equal(p.status, 200);
  assert.deepEqual(p.json, { bloqueado: true, motivos: ['tiene_trabajos'], cuenta: { ...CUENTA_DEL_SEMBRADO, trabajos: 1 } });
  assert.deepEqual(db, antes, 'la previa no escribe');
});

test('SCRUM-1868d · 🔴 con solo mensajes, el DELETE da 204 y sus dos mensajes siguen, desligados y con su teléfono y su correo', async () => {
  sembrar({ mensajes: true });
  const p = await previa();
  assert.deepEqual(p.json, { bloqueado: false, motivos: [], cuenta: CUENTA_DEL_SEMBRADO }, 'los mensajes ni bloquean ni entran en la cuenta');
  const r = await borrar();
  assert.equal(r.status, 204, `dio ${r.status} ${JSON.stringify(r.json)}`);
  assert.equal(filasDeA().customer, 0, 'el cliente se ha ido');
  assert.deepEqual(db.whatsAppMessage.find((m) => m.id === 1), { id: 1, merchantId: A, customerId: null, toPhone: '+34600000001' });
  assert.deepEqual(db.emailMessage.find((m) => m.id === 1), { id: 1, merchantId: A, customerId: null, toEmail: 'a@ejemplo.test' });
  assert.deepEqual(MENSAJES.map((t) => db[t].length), [3, 3], 'ningún mensaje se borra');
});

test('SCRUM-1868d · 🔴 tenencia de los mensajes: los de B con el mismo número de cliente y los de otro cliente de A no se tocan', async () => {
  sembrar({ mensajes: true });
  const ajenos = () => structuredClone(MENSAJES.map((t) => db[t].filter((m) => m.id >= 900)));
  const antes = ajenos();
  assert.equal(antes.flat().length, 4, 'control: hay cuatro mensajes ajenos sembrados');
  assert.equal((await borrar()).status, 204);
  assert.deepEqual(ajenos(), antes);
  // Y B, pidiendo el cliente de A, no desliga nada (404 antes de tocar).
  sembrar({ mensajes: true });
  const todo = structuredClone(db);
  assert.equal((await borrar(CLI_A, { merchantId: B })).status, 404);
  assert.deepEqual(db, todo);
});

test('SCRUM-1868d · 🔴 un fallo después de desligar los mensajes los deja como estaban (misma transacción)', async () => {
  sembrar({ mensajes: true });
  db.customer[0].falla = true; // la fila del cliente es lo ÚLTIMO que se borra
  const antes = structuredClone(db);
  const r = await borrar();
  assert.equal(r.status, 500);
  assert.deepEqual(db, antes, 'el desligue no sobrevive a un borrado que falla');
});

test('SCRUM-1868a · 🔴 permisos: el técnico recibe 403 en la previa y en el borrado, y el admin no (positivo)', async () => {
  sembrar();
  const tec = { rol: 'tecnico' };
  assert.equal((await previa(CLI_A, tec)).status, 403);
  assert.equal((await borrar(CLI_A, tec)).status, 403);
  assert.equal(filasDeA().customer, 1, 'tras el 403, el cliente sigue');
  assert.equal((await previa()).status, 200);
});
