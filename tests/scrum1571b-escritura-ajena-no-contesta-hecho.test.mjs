// SCRUM-1571b · ninguna ruta que escribe sobre un `:id` tira el `count` de un `updateMany`/`deleteMany` con
// `merchantId` y contesta «hecho» igual.
//
// SCRUM-1571 lo arregló en `DELETE` y `PUT`/`PATCH /admin/customers/:id`: con el id de OTRO comercio, o uno que
// no existe, contestaban 204 y 200 sin haber escrito nada. Este test barre TODAS las rutas de `src/` con el censo
// por AST de `tests/_censo-escrituras-sobre-id.mjs` (población, criterio y límites, en su cabecera).
//
// Lee `src/` con el compilador de TypeScript, no `dist/`: corre igual en local y en CI, sin base y sin saltos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { censar } from './_censo-escrituras-sobre-id.mjs';

const conSemilla = censar({ semilla: true });
const sinSemilla = censar({ semilla: false });
const SEMILLA = 'src/__semilla_scrum1571b__.ts';

test('SCRUM-1571b · el censo ve su positivo SEMBRADO (DELETE /semilla/:id tira el count y contesta 204)', () => {
  assert.equal(conSemilla.semillaVista, true, 'el censo no ve la ruta fabricada con el defecto: está CIEGO');
});

test('SCRUM-1571b · sin la semilla el censo dice CIEGO, no verde', () => {
  assert.equal(sinSemilla.semillaVista, false);
  assert.equal(sinSemilla.rutas.some((r) => r.sitio.startsWith(SEMILLA)), false);
});

test('SCRUM-1571b · población: el censo ve las rutas de src/ y la escritura de SCRUM-1571', () => {
  // Suelo de identidad, no de número: si el resolvedor deja de seguir imports, la ruta de 1571 deja de
  // alcanzar su `deleteMany` (vive en `customerAdmin.ts`, a dos llamadas del manejador).
  const borrarCliente = sinSemilla.conId.find((r) => r.verbo === 'DELETE' && r.ruta === '/:id'
    && r.sitio.startsWith('src/modules/system/app/routes/customersAdmin.routes.ts:'));
  assert.ok(borrarCliente, 'no aparece DELETE /:id de customersAdmin.routes.ts');
  assert.ok(borrarCliente.escrituras.some((w) => w.op === 'customer.deleteMany' && w.merchantId),
    'DELETE /admin/customers/:id ya no alcanza su customer.deleteMany: el resolvedor no sigue los imports');
  assert.ok(sinSemilla.ficheros > 0 && sinSemilla.conId.length > 0, `población vacía: ${sinSemilla.ficheros} ficheros`);
  console.log(`# población: ${sinSemilla.ficheros} ficheros · ${sinSemilla.rutas.length} rutas · ${sinSemilla.conId.length} sobre un :id · ${sinSemilla.conEscritura.length} con escritura many + merchantId`);
});

test('SCRUM-1571b · ninguna ruta de src/ tira el count de una escritura ajena y contesta «hecho»', () => {
  const malas = sinSemilla.sospechosas.map((r) => `${r.verbo} ${r.ruta} · ${r.sitio} · ${r.escrituras
    .filter((w) => w.merchantId).map((w) => `${w.op} → ${w.destino} (${w.sitio})`).join(', ')}`);
  assert.deepEqual(malas, [], 'con el id de OTRO comercio el where no casa, count 0, y la ruta contesta éxito igual.\n'
    + 'Lee el count y contesta 404 { error: \'not_found\' }, como DELETE /admin/customers/:id (SCRUM-1571).');
});
