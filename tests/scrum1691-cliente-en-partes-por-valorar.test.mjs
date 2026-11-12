// SCRUM-1691 (PILOTO-1, X2 de SCRUM-1686 c.21459) — y el mismo arreglo que 1680-C (SCRUM-1680 c.21460).
//
// «Partes por valorar» pintaba «—» en la columna del cliente: `GET /admin/partes/oficina/pendientes`
// serializaba la fila sin resolver el nombre (`clienteNombre` llegaba siempre `null`), cuando abrir el
// mismo parte (`findParte`) sí lo resuelve con `nombreDelCliente` (id + merchantId).
//
// El banco: la RUTA de verdad (`dist/…/partes.routes.js`) con la base doblada por `_envio-doblado.mjs`,
// como `scrum1226`. Cada respuesta de la base EVALÚA su `where` como Postgres —tenencia incluida—,
// porque es lo que se mide: un doble que devolviera todos los clientes daría el nombre de otro merchant
// y el test no lo vería.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inyectarBase, moduloDeDist, MERCHANT } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const RUTAS = '../dist/modules/jobs/app/routes/partes.routes.js';
const copia = (x) => JSON.parse(JSON.stringify(x));

const MARIA = { id: 7, merchantId: MERCHANT, name: 'María López' };
const AJENO = { id: 99, merchantId: MERCHANT + 1, name: 'Cliente de OTRO merchant' };

/** Un parte firmado y SIN valorar (una línea sin precio), del cliente que se diga. */
const parte = (id, customerId) => ({
  id, merchantId: MERCHANT, jobId: 500 + id, customerId,
  numero: `PT-2026-${id}`, fecha: '2026-11-10T08:00:00.000Z', obra: null, referencia: null, tipo: null,
  tecnicos: [], notas: null, estado: 'firmado', firmadoAt: '2026-11-10T12:00:00.000Z', firmadoPorNombre: 'Firmante',
  lineas: [{ id: 'l1', bloque: 'mano_obra', unds: 1, descripcion: 'Hora', precioUnitario: null, tipoIva: null }],
});

function banco(partes) {
  const consultasDeClientes = [];
  const enLista = (x, filtro) => (filtro && typeof filtro === 'object' && 'in' in filtro ? filtro.in.includes(x) : x === filtro);
  const clientesQueCasan = (where) => [MARIA, AJENO].filter((c) => c.merchantId === where.merchantId && enLista(c.id, where.id));
  inyectarBase({
    'parteTrabajo.findMany': ({ where }) =>
      partes.filter((p) => p.merchantId === where.merchantId && p.estado === where.estado).map(copia),
    'customer.findMany': (args) => {
      consultasDeClientes.push(copia(args));
      return clientesQueCasan(args.where).map((c) => ({ id: c.id, name: c.name }));
    },
    'customer.findFirst': (args) => {
      consultasDeClientes.push(copia(args));
      const c = clientesQueCasan(args.where)[0];
      return c ? { id: c.id, name: c.name } : null;
    },
  }, [RUTAS]);
  const router = moduloDeDist(RUTAS).default;
  const capa = router.stack.find((l) => l.route && l.route.path === '/oficina/pendientes' && l.route.methods.get);
  assert.ok(capa, '🔴 CIEGO: no encuentro GET /oficina/pendientes en el router de partes');
  const h = capa.route.stack[capa.route.stack.length - 1].handle;
  return {
    consultasDeClientes,
    async pendientes() {
      const r = { status: 200, data: undefined };
      const res = { status(s) { r.status = s; return res; }, json(j) { r.data = copia(j); return res; } };
      await h(reqDeSesion({ rol: 'admin', merchantId: MERCHANT, query: {}, params: {} }), res);
      return r;
    },
  };
}

test('SCRUM-1691 · SUELO: la ruta de verdad devuelve los partes sembrados como pendientes', async () => {
  const b = banco([parte(1, MARIA.id), parte(2, null)]);
  const r = await b.pendientes();
  assert.equal(r.status, 200);
  assert.equal(r.data.pendientes.length, 2, `🔴 SUELO: la lista no devolvió los 2 partes sembrados (${JSON.stringify(r.data)}); lo de abajo sería un verde vacío`);
});

test('SCRUM-1691 · 🔴 la fila de «Partes por valorar» trae el NOMBRE del cliente', async () => {
  const b = banco([parte(1, MARIA.id)]);
  const { data } = await b.pendientes();
  assert.equal(data.pendientes[0].clienteNombre, 'María López',
    `🔴 la fila llega con clienteNombre=${JSON.stringify(data.pendientes[0].clienteNombre)} y la pantalla pinta «—»`);
});

test('SCRUM-1691 · sin cliente, `null` (un parte puede abrirse antes de saber de quién es); nada inventado', async () => {
  const b = banco([parte(2, null)]);
  const { data } = await b.pendientes();
  assert.equal(data.pendientes[0].clienteNombre, null);
});

test('SCRUM-1691 · 🔴 regla 2: un customerId de OTRO merchant no pone su nombre en la fila', async () => {
  const b = banco([parte(3, AJENO.id), parte(1, MARIA.id)]);
  const { data } = await b.pendientes();
  const porId = new Map(data.pendientes.map((p) => [p.id, p.clienteNombre]));
  assert.equal(porId.get(3), null, '🔴 se cuela el nombre de un cliente de otro merchant');
  assert.equal(porId.get(1), 'María López', 'CONTROL POSITIVO: el del propio merchant sí sale');
  for (const q of b.consultasDeClientes) assert.equal(q.where.merchantId, MERCHANT, 'regla 2: la consulta de clientes va acotada al merchant');
});

test('SCRUM-1691 · coste constante: UNA consulta de clientes para toda la lista, no una por fila', async () => {
  const b = banco([parte(1, MARIA.id), parte(4, MARIA.id), parte(5, MARIA.id), parte(2, null)]);
  const { data } = await b.pendientes();
  assert.deepEqual(data.pendientes.map((p) => p.clienteNombre).sort(), ['María López', 'María López', 'María López', null].sort());
  assert.equal(b.consultasDeClientes.length, 1, `🔴 ${b.consultasDeClientes.length} consultas de clientes para 4 filas`);
});
