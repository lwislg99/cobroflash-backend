// tests/scrum1571-cliente-ajeno-no-contesta-hecho.test.mjs — SCRUM-1571
//
// 🔴 BORRAR EL CLIENTE DE OTRO COMERCIO CONTESTABA `204` SIN BORRAR NADA. La separación entre
// comercios aguantaba (`deleteMany({ where: { id, merchantId } })` no casa la fila ajena), pero la
// ruta no miraba el `count` y contestaba «borrado» igual. Medido por J3 el 20-oct-2026 sobre
// `e0c32fb52` con Prisma y Postgres de verdad (descripción del ticket).
//
// El hermano del MISMO fichero, con el mismo patrón: `PUT`/`PATCH /:id` hacía `updateMany` sin mirar
// el `count` y contestaba `200` con cuerpo `null` («guardado», y la pantalla de Clientes pintaba
// «Cliente actualizado correctamente.»). Los dos pasan a contestar lo que ya contesta `GET /:id`
// para un cliente que no es tuyo o no existe: `404 { error: 'not_found' }`.
//
// ── EL BANCO ──────────────────────────────────────────────────────────────────────────────
// Se llama a la RUTA REAL: el router de `dist/`, montado en Express con su `requireRole` y pedido
// por `node:http` (A10: «un test que saca el handler de su ruta prueba el handler, no la ruta»).
// Sólo la sesión va doblada (comercio 2, admin) y la base es una tabla en memoria que hace lo que
// hace Postgres con estos `where`: casa por TODOS sus campos y devuelve cuántas filas tocó. Su
// propio control (el primer caso) demuestra que SABE borrar y editar la fila ajena cuando se le
// pide con su comercio: si no supiera, «no se borró» sería ceguera del banco y no la regla 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { inyectarBase, moduloDeDist } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const requiere = createRequire(import.meta.url);

const MIO = 2;
const AJENO = 3;
/** El reparto del ticket: cuatro clientes del comercio 2 y el `5`, del comercio 3. */
const SIEMBRA = () => [
  { id: 1, merchantId: MIO, name: 'Uno', companyId: null },
  { id: 2, merchantId: MIO, name: 'Dos', companyId: null },
  { id: 3, merchantId: MIO, name: 'Tres', companyId: null },
  { id: 4, merchantId: MIO, name: 'Cuatro', companyId: null },
  { id: 5, merchantId: AJENO, name: 'Cinco ajeno', companyId: null },
];
let tabla = SIEMBRA();

const casa = (fila, where = {}) => Object.entries(where).every(([k, v]) => fila[k] === v);
const respuestas = {
  'customer.findFirst': ({ where }) => tabla.find((f) => casa(f, where)) ?? null,
  'customer.updateMany': ({ where, data }) => {
    const tocadas = tabla.filter((f) => casa(f, where));
    for (const f of tocadas) Object.assign(f, data);
    return { count: tocadas.length };
  },
  'customer.deleteMany': ({ where }) => {
    const antes = tabla.length;
    tabla = tabla.filter((f) => !casa(f, where));
    return { count: antes - tabla.length };
  },
};
inyectarBase(respuestas);

const express = requiere('express');
const router = moduloDeDist('../dist/modules/system/app/routes/customersAdmin.routes.js').default;

/** Pide `metodo ruta` a la ruta real, como el comercio 2 con rol admin. */
async function pedir(metodo, ruta, cuerpo) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { Object.assign(req, reqDeSesion({ rol: 'admin', merchantId: MIO })); next(); });
  app.use('/admin/customers', router);
  const srv = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  const callar = console.error; console.error = () => {};
  try {
    return await new Promise((ok, ko) => {
      const datos = cuerpo === undefined ? '' : JSON.stringify(cuerpo);
      const pet = http.request({
        host: '127.0.0.1', port: srv.address().port, path: ruta, method: metodo,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(datos) },
      }, (res) => {
        let b = '';
        res.on('data', (c) => { b += c; });
        res.on('end', () => ok({ status: res.statusCode, cuerpo: b === '' ? undefined : JSON.parse(b) }));
      });
      pet.on('error', ko);
      pet.end(datos);
    });
  } finally {
    console.error = callar;
    await new Promise((ok) => srv.close(ok));
  }
}

const ids = () => tabla.map((f) => f.id).sort((a, b) => a - b);

test('SCRUM-1571 · CONTROL DEL BANCO: con SU comercio, la fila ajena se edita y se borra (el banco no es ciego)', () => {
  tabla = SIEMBRA();
  assert.deepEqual(respuestas['customer.updateMany']({ where: { id: 5, merchantId: AJENO }, data: { name: 'x' } }), { count: 1 });
  assert.deepEqual(respuestas['customer.deleteMany']({ where: { id: 5, merchantId: AJENO } }), { count: 1 });
  assert.deepEqual(ids(), [1, 2, 3, 4]);
  // Y con el comercio equivocado, no: es lo que la ruta le pide en los casos de abajo.
  tabla = SIEMBRA();
  assert.deepEqual(respuestas['customer.deleteMany']({ where: { id: 5, merchantId: MIO } }), { count: 0 });
  assert.deepEqual(ids(), [1, 2, 3, 4, 5]);
});

test('SCRUM-1571 · 🔴 DELETE del cliente de OTRO comercio → 404 not_found, y no se borra nada', async () => {
  tabla = SIEMBRA();
  const r = await pedir('DELETE', '/admin/customers/5');
  assert.equal(r.status, 404, `🔴 contesta ${r.status}: afirma haber borrado un cliente que no ha tocado`);
  assert.deepEqual(r.cuerpo, { error: 'not_found' });
  assert.deepEqual(ids(), [1, 2, 3, 4, 5], 'la separación entre comercios tiene que seguir aguantando');
});

test('SCRUM-1571 · DELETE de un id que no existe en NINGÚN comercio → el mismo 404 (no se distingue de uno ajeno)', async () => {
  tabla = SIEMBRA();
  const r = await pedir('DELETE', '/admin/customers/99');
  assert.equal(r.status, 404);
  assert.deepEqual(r.cuerpo, { error: 'not_found' });
  assert.deepEqual(ids(), [1, 2, 3, 4, 5]);
});

test('SCRUM-1571 · CONTROL NEGATIVO: DELETE de un cliente PROPIO sigue contestando 204 y sigue borrándolo (solo a él)', async () => {
  tabla = SIEMBRA();
  const r = await pedir('DELETE', '/admin/customers/2');
  assert.equal(r.status, 204, `🔴 un borrado legítimo contesta ${r.status}`);
  assert.equal(r.cuerpo, undefined);
  assert.deepEqual(ids(), [1, 3, 4, 5]);
});

// PUT y PATCH comparten handler (SCRUM-1138), pero son dos rutas: cada una lleva su caso, con nombre
// literal (los nombres construidos en un bucle los vigila `scrum1415`).
const editarAjeno = (verbo) => async () => {
  tabla = SIEMBRA();
  const r = await pedir(verbo, '/admin/customers/5', { name: 'Pisado' });
  assert.equal(r.status, 404, `🔴 contesta ${r.status} con ${JSON.stringify(r.cuerpo)}: «guardado» sin haber guardado nada`);
  assert.deepEqual(r.cuerpo, { error: 'not_found' });
  assert.equal(tabla.find((f) => f.id === 5).name, 'Cinco ajeno');
};
const editarPropio = (verbo) => async () => {
  tabla = SIEMBRA();
  const r = await pedir(verbo, '/admin/customers/3', { name: 'Tres editado' });
  assert.equal(r.status, 200, `🔴 una edición legítima contesta ${r.status}`);
  assert.equal(r.cuerpo?.id, 3);
  assert.equal(r.cuerpo?.name, 'Tres editado');
  assert.equal(tabla.find((f) => f.id === 5).name, 'Cinco ajeno');
};
test('SCRUM-1571 · 🔴 PUT del cliente de OTRO comercio → 404 not_found, y su fila no cambia', editarAjeno('PUT'));
test('SCRUM-1571 · CONTROL NEGATIVO: PUT de un cliente PROPIO sigue contestando 200 con la fila editada', editarPropio('PUT'));
test('SCRUM-1571 · 🔴 PATCH del cliente de OTRO comercio → 404 not_found, y su fila no cambia', editarAjeno('PATCH'));
test('SCRUM-1571 · CONTROL NEGATIVO: PATCH de un cliente PROPIO sigue contestando 200 con la fila editada', editarPropio('PATCH'));
