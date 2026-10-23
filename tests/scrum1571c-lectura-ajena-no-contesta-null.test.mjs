// SCRUM-1571c · ninguna ruta sobre un `:id` lee con `findFirst`/`findUnique` + `merchantId` y, si no encuentra,
// contesta 200 con cuerpo `null` (o `{}`) en vez de 404.
//
// Es el hueco que dejó declarado el censo de SCRUM-1571b («"200 con cuerpo null" sin updateMany: no lo censa»).
// Se mide con el MISMO censo (`tests/_censo-escrituras-sobre-id.mjs`, criterio y límites en su bloque 1571c), que
// lleva dos positivos SEMBRADOS (lectura directa, y a través de un servicio con `{ ...fila }`) y un negativo
// sembrado (la misma lectura con su 404). Sin la siembra, el censo dice CIEGO, no verde.
//
// Lo único que encontró en `src/` el 21-oct-2026 fue `PUT`/`PATCH /admin/customers/:id`: tras el arreglo de
// SCRUM-1571 miran el `count` del `updateMany`, pero después RELEEN el cliente y lo mandan sin mirarlo. Si otra
// petición lo borra entre las dos consultas, contestan `200 null`. El banco de abajo provoca esa carrera contra la
// RUTA REAL (el router de `dist/` en Express, pedido por `node:http`; A10, SCRUM-1344), con el arnés de SCRUM-1571.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { censar, SEMILLAS_LECTURA } from './_censo-escrituras-sobre-id.mjs';
import { inyectarBase, moduloDeDist } from './_envio-doblado.mjs';
import { reqDeSesion } from './_arnes-de-router.mjs';

const conSemilla = censar({ semilla: true }).lectura;
const sinSemilla = censar({ semilla: false }).lectura;
const deSemilla = (r) => r.sitio.includes('__semilla_scrum1571b__');

test('SCRUM-1571c · el censo ve sus dos positivos SEMBRADOS (200 con null directo, y {} a través de un servicio)', () => {
  assert.equal(conSemilla.semillaVista, true, `no ve ${SEMILLAS_LECTURA.conDefecto.join(' / ')}: está CIEGO`);
});

test('SCRUM-1571c · el negativo SEMBRADO (la misma lectura con su 404) no sale señalado', () => {
  assert.equal(conSemilla.semillaLimpiaCallada, true, `señala ${SEMILLAS_LECTURA.sinDefecto.join(' / ')}, que sí mira el null`);
});

test('SCRUM-1571c · sin la semilla el censo de lecturas dice CIEGO, no verde', () => {
  assert.equal(sinSemilla.semillaVista, false);
  assert.equal(sinSemilla.rutas.some(deSemilla), false);
});

test('SCRUM-1571c · población: lee las rutas sobre un :id y ve la lectura de GET /admin/customers/:id', () => {
  // Suelo de identidad: GET /:id de clientes lee con `getCustomer` (findFirst + merchantId, en `customerAdmin.ts`)
  // y SÍ mira el null. Si el resolvedor deja de seguir imports, deja de saber que ese valor es anulable.
  const get = sinSemilla.rutas.find((r) => r.verbo === 'GET' && r.ruta === '/:id'
    && r.sitio.startsWith('src/modules/system/app/routes/customersAdmin.routes.ts:'));
  assert.ok(get, 'no aparece GET /:id de customersAdmin.routes.ts');
  assert.equal(get.analizable, true);
  assert.ok(sinSemilla.conLectura.length > 0, 'ninguna ruta con findFirst/findUnique + merchantId: población vacía');
  assert.equal(sinSemilla.sinManejador.length, 0, `rutas sin manejador legible: ${sinSemilla.sinManejador.map((r) => r.sitio).join(', ')}`);
  console.log(`# población: ${sinSemilla.rutas.length} rutas sobre un :id · ${sinSemilla.conLectura.length} con findFirst/findUnique + merchantId en el manejador`);
});

test('SCRUM-1571c · ninguna ruta de src/ contesta 200 con null o {} cuando la lectura con merchantId no encuentra', () => {
  const malas = sinSemilla.sospechosas.map((r) => `${r.verbo} ${r.ruta} · ${r.sitio} · ${r.nulos.map((n) => `«${n.valor}» (${n.envio})`).join(', ')}`);
  assert.deepEqual(malas, [], 'con el id de OTRO comercio (o ya borrado) la lectura da null y la ruta lo manda con 200.\n'
    + 'Míralo y contesta 404 { error: \'not_found\' }, como GET /admin/customers/:id.');
});

// ── LA CARRERA, CONTRA LA RUTA REAL ──────────────────────────────────────────────────────────────────────────
const requiere = createRequire(import.meta.url);
const MIO = 2;
const SIEMBRA = () => [{ id: 3, merchantId: MIO, name: 'Tres', companyId: null }];
let tabla = SIEMBRA();
let borrarAlEditar = false; // la otra petición: borra la fila justo después de que el updateMany la toque
const casa = (fila, where = {}) => Object.entries(where).every(([k, v]) => fila[k] === v);
const respuestas = {
  'customer.findFirst': ({ where }) => tabla.find((f) => casa(f, where)) ?? null,
  'customer.updateMany': ({ where, data }) => {
    const tocadas = tabla.filter((f) => casa(f, where));
    for (const f of tocadas) Object.assign(f, data);
    if (borrarAlEditar) tabla = tabla.filter((f) => !tocadas.includes(f));
    return { count: tocadas.length };
  },
};
inyectarBase(respuestas);
const express = requiere('express');
const router = moduloDeDist('../dist/modules/system/app/routes/customersAdmin.routes.js').default;

async function pedir(metodo, ruta, cuerpo) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { Object.assign(req, reqDeSesion({ rol: 'admin', merchantId: MIO })); next(); });
  app.use('/admin/customers', router);
  const srv = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  const callar = console.error; console.error = () => {};
  try {
    return await new Promise((ok, ko) => {
      const datos = JSON.stringify(cuerpo);
      const pet = http.request({
        host: '127.0.0.1', port: srv.address().port, path: ruta, method: metodo,
        headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(datos) },
      }, (res) => {
        let b = '';
        res.on('data', (c) => { b += c; });
        res.on('end', () => ok({ status: res.statusCode, crudo: b, cuerpo: b === '' ? undefined : JSON.parse(b) }));
      });
      pet.on('error', ko);
      pet.end(datos);
    });
  } finally {
    console.error = callar;
    await new Promise((ok) => srv.close(ok));
  }
}

const carrera = (verbo) => async () => {
  tabla = SIEMBRA(); borrarAlEditar = true;
  try {
    const r = await pedir(verbo, '/admin/customers/3', { name: 'Tres editado' });
    assert.equal(r.status, 404, `🔴 contesta ${r.status} con «${r.crudo}»: «guardado» de un cliente que ya no existe`);
    assert.deepEqual(r.cuerpo, { error: 'not_found' });
  } finally { borrarAlEditar = false; }
};
const sinCarrera = (verbo) => async () => {
  tabla = SIEMBRA();
  const r = await pedir(verbo, '/admin/customers/3', { name: 'Tres editado' });
  assert.equal(r.status, 200, `🔴 una edición legítima contesta ${r.status}`);
  assert.equal(r.cuerpo?.id, 3);
  assert.equal(r.cuerpo?.name, 'Tres editado');
};
test('SCRUM-1571c · 🔴 PUT de un cliente borrado entre el update y la relectura → 404 not_found, no 200 null', carrera('PUT'));
test('SCRUM-1571c · CONTROL DEL BANCO: PUT sin carrera sigue contestando 200 con la fila editada', sinCarrera('PUT'));
test('SCRUM-1571c · 🔴 PATCH de un cliente borrado entre el update y la relectura → 404 not_found, no 200 null', carrera('PATCH'));
test('SCRUM-1571c · CONTROL DEL BANCO: PATCH sin carrera sigue contestando 200 con la fila editada', sinCarrera('PATCH'));
