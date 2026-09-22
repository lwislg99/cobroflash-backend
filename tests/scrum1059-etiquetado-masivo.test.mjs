// tests/scrum1059-etiquetado-masivo.test.mjs — SCRUM-1059 (CRM-17)
//
// AÑADIR/QUITAR una etiqueta a VARIOS clientes a la vez, medido por la SUPERFICIE PÚBLICA
// (`etiquetarSeleccion`) con un `cliente` de mentira — el mismo patrón que
// `scrum312-importador-clientes.test.mjs`. La decisión por-cliente (`aplicarEtiquetaMasiva`) vive
// SIN exportar dentro del módulo (SCRUM-411: un export sin más consumidor que su propio test es un
// huérfano) y queda cubierta por esto, sin Postgres.
//
// La mitad con base real (tenencia, transacción de verdad) vive en
// `scrum1059b-etiquetado-masivo-postgres.test.mjs`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { etiquetarSeleccion } from '../dist/modules/system/domain/etiquetadoMasivo.js';

/**
 * Cliente de mentira: un `Map` en memoria con el mismo contrato que `etiquetarSeleccion` le pide
 * a Prisma (`customer.findMany`, `customer.updateMany`, `$transaction`).
 */
function clienteFalso(existentes = []) {
  const filas = new Map(existentes.map((c) => [c.id, { ...c }]));
  return {
    filas,
    customer: {
      findMany: async ({ where }) => {
        const ids = where.id?.in ?? [];
        return ids
          .map((id) => filas.get(id))
          .filter((c) => c && c.merchantId === where.merchantId)
          .map(({ id, tags }) => ({ id, tags: tags ?? null }));
      },
      updateMany: async ({ where, data }) => {
        const c = filas.get(where.id);
        if (!c || c.merchantId !== where.merchantId) return { count: 0 };
        c.tags = data.tags;
        return { count: 1 };
      },
    },
    $transaction: async (ops) => Promise.all(ops),
  };
}

test('add · un cliente sin la etiqueta la recibe', async () => {
  const cl = clienteFalso([{ id: 1, merchantId: 7, tags: ['moroso'] }]);
  const r = await etiquetarSeleccion(7, [1], 'add', 'urgente', cl);
  assert.equal(r.actualizados, 1);
  assert.equal(r.resultados[0].actualizado, true);
  assert.equal(r.resultados[0].motivo, undefined);
  assert.deepEqual(cl.filas.get(1).tags, ['moroso', 'urgente']);
});

test('add · un cliente que YA la tiene no se toca (ni se duplica)', async () => {
  const cl = clienteFalso([{ id: 1, merchantId: 7, tags: ['Moroso'] }]);
  const r = await etiquetarSeleccion(7, [1], 'add', 'moroso', cl);
  assert.equal(r.actualizados, 0, '🔴 duplicaría la etiqueta con otra capitalización');
  assert.equal(r.resultados[0].motivo, 'Ya la tenía');
  assert.deepEqual(cl.filas.get(1).tags, ['Moroso'], '🔴 un no-actualizado no debe escribir nada');
});

test('add · un cliente con 20 etiquetas NO rompe: se declara y sigue sin la 21', async () => {
  const veinte = Array.from({ length: 20 }, (_, i) => `tag${i}`);
  const cl = clienteFalso([{ id: 1, merchantId: 7, tags: veinte }]);
  const r = await etiquetarSeleccion(7, [1], 'add', 'tag20', cl);
  assert.equal(r.actualizados, 0);
  assert.equal(r.resultados[0].motivo, 'Ya tiene 20 etiquetas');
  assert.equal(cl.filas.get(1).tags.length, 20);
});

test('add · el resto de la selección SIGUE aunque uno de ellos ya tenga 20 (no tumba a los demás)', async () => {
  const veinte = Array.from({ length: 20 }, (_, i) => `tag${i}`);
  const cl = clienteFalso([
    { id: 1, merchantId: 7, tags: veinte },
    { id: 2, merchantId: 7, tags: ['moroso'] },
  ]);
  const r = await etiquetarSeleccion(7, [1, 2], 'add', 'nueva', cl);
  const porId = new Map(r.resultados.map((x) => [x.id, x]));
  assert.equal(porId.get(1).actualizado, false, '🔴 el lleno se marca como no actualizado');
  assert.equal(porId.get(2).actualizado, true, '🔴 el defecto del uno tumbó al otro');
  assert.equal(r.actualizados, 1);
});

test('add · etiqueta vacía o solo espacios se rechaza con su motivo', async () => {
  const cl = clienteFalso([{ id: 1, merchantId: 7, tags: null }]);
  const r = await etiquetarSeleccion(7, [1], 'add', '   ', cl);
  assert.equal(r.actualizados, 0);
  assert.equal(r.resultados[0].motivo, 'Etiqueta vacía');
});

test('add · un cliente SIN etiquetas (`tags: null`) recibe la primera', async () => {
  const cl = clienteFalso([{ id: 1, merchantId: 7, tags: null }]);
  const r = await etiquetarSeleccion(7, [1], 'add', 'nueva', cl);
  assert.equal(r.actualizados, 1);
  assert.deepEqual(cl.filas.get(1).tags, ['nueva']);
});

test('remove · un cliente que la tiene la pierde', async () => {
  const cl = clienteFalso([{ id: 1, merchantId: 7, tags: ['moroso', 'urgente'] }]);
  const r = await etiquetarSeleccion(7, [1], 'remove', 'moroso', cl);
  assert.equal(r.actualizados, 1);
  assert.deepEqual(cl.filas.get(1).tags, ['urgente']);
});

test('remove · sin distinguir mayúsculas, y quitar la única deja NULL (no `[]`)', async () => {
  const cl = clienteFalso([{ id: 1, merchantId: 7, tags: ['Moroso'] }]);
  const r = await etiquetarSeleccion(7, [1], 'remove', 'MOROSO', cl);
  assert.equal(r.actualizados, 1);
  // `Prisma.DbNull` (NULL de SQL): la MISMA traducción de `tagsParaPrisma` que alta y edición.
  assert.deepEqual(cl.filas.get(1).tags, Prisma.DbNull, '🔴 ausente ≠ vacío: no puede quedar `[]`');
});

test('remove · un cliente que NO la tiene no se toca', async () => {
  const cl = clienteFalso([{ id: 1, merchantId: 7, tags: ['moroso'] }]);
  const r = await etiquetarSeleccion(7, [1], 'remove', 'urgente', cl);
  assert.equal(r.actualizados, 0);
  assert.equal(r.resultados[0].motivo, 'No la tenía');
});

test('remove · un cliente sin etiquetas no revienta', async () => {
  const cl = clienteFalso([{ id: 1, merchantId: 7, tags: null }]);
  const r = await etiquetarSeleccion(7, [1], 'remove', 'lo-que-sea', cl);
  assert.equal(r.actualizados, 0);
  assert.equal(r.resultados[0].motivo, 'No la tenía');
});

test('un id de OTRO merchant se declara "No encontrado", sin revelar que existe en otro sitio', async () => {
  const cl = clienteFalso([{ id: 1, merchantId: 999, tags: ['moroso'] }]);
  const r = await etiquetarSeleccion(7, [1], 'add', 'x', cl);
  assert.equal(r.actualizados, 0);
  assert.equal(r.resultados[0].motivo, 'No encontrado');
  assert.deepEqual(cl.filas.get(1).tags, ['moroso'], '🔴 no puede escribir en un cliente de otro merchant');
});

test('selección vacía: no revienta, no consulta nada', async () => {
  const cl = clienteFalso([]);
  const r = await etiquetarSeleccion(7, [], 'add', 'x', cl);
  assert.deepEqual(r, { actualizados: 0, resultados: [] });
});
