// tests/scrum1059-etiquetado-masivo.test.mjs — SCRUM-1059 (CRM-17)
//
// AÑADIR/QUITAR una etiqueta a VARIOS clientes a la vez. `aplicarEtiquetaMasiva` es la mitad PURA
// —decide sin tocar la base— y es donde vive el riesgo real: que un cliente que no se puede
// actualizar (ya la tenía, ya tiene 20, etiqueta vacía) no tumbe a los demás, y que la etiqueta
// resultante sea la MISMA decisión que el alta y la edición manual (`tagsDelCliente.ts`).
//
// La mitad con base (`etiquetarSeleccion`: tenencia + transacción) va en su propio fichero
// gateado (`scrum1059b-etiquetado-masivo-postgres.test.mjs`), como el resto de la casa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { aplicarEtiquetaMasiva } from '../dist/modules/system/domain/etiquetadoMasivo.js';

test('add · un cliente sin la etiqueta la recibe', () => {
  const { resultado, siguiente } = aplicarEtiquetaMasiva({ id: 1, tags: ['moroso'] }, 'add', 'urgente');
  assert.equal(resultado.actualizado, true);
  assert.equal(resultado.motivo, undefined);
  assert.deepEqual(siguiente, ['moroso', 'urgente']);
});

test('add · un cliente que YA la tiene no se toca (ni se duplica)', () => {
  const { resultado, siguiente } = aplicarEtiquetaMasiva({ id: 1, tags: ['Moroso'] }, 'add', 'moroso');
  assert.equal(resultado.actualizado, false, '🔴 duplicaría la etiqueta con otra capitalización');
  assert.equal(resultado.motivo, 'Ya la tenía');
  assert.equal(siguiente, null, '🔴 un no-actualizado no debe traer nada que escribir');
});

test('add · un cliente con 20 etiquetas NO rompe: se declara y sigue sin la 21', () => {
  const veinte = Array.from({ length: 20 }, (_, i) => `tag${i}`);
  const { resultado, siguiente } = aplicarEtiquetaMasiva({ id: 1, tags: veinte }, 'add', 'tag20');
  assert.equal(resultado.actualizado, false);
  assert.equal(resultado.motivo, 'Ya tiene 20 etiquetas');
  assert.equal(siguiente, null);
});

test('add · el resto de la selección SIGUE aunque uno de ellos ya tenga 20 (no tumba a los demás)', () => {
  const veinte = Array.from({ length: 20 }, (_, i) => `tag${i}`);
  const lleno = aplicarEtiquetaMasiva({ id: 1, tags: veinte }, 'add', 'nueva');
  const libre = aplicarEtiquetaMasiva({ id: 2, tags: ['moroso'] }, 'add', 'nueva');
  assert.equal(lleno.resultado.actualizado, false, '🔴 el lleno se marca como no actualizado');
  assert.equal(libre.resultado.actualizado, true, '🔴 el defecto del uno tumbó al otro');
});

test('add · etiqueta vacía o solo espacios se rechaza con su motivo', () => {
  const { resultado, siguiente } = aplicarEtiquetaMasiva({ id: 1, tags: null }, 'add', '   ');
  assert.equal(resultado.actualizado, false);
  assert.equal(resultado.motivo, 'Etiqueta vacía');
  assert.equal(siguiente, null);
});

test('add · un cliente SIN etiquetas (`tags: null`) recibe la primera', () => {
  const { resultado, siguiente } = aplicarEtiquetaMasiva({ id: 1, tags: null }, 'add', 'nueva');
  assert.equal(resultado.actualizado, true);
  assert.deepEqual(siguiente, ['nueva']);
});

test('remove · un cliente que la tiene la pierde', () => {
  const { resultado, siguiente } = aplicarEtiquetaMasiva({ id: 1, tags: ['moroso', 'urgente'] }, 'remove', 'moroso');
  assert.equal(resultado.actualizado, true);
  assert.deepEqual(siguiente, ['urgente']);
});

test('remove · sin distinguir mayúsculas', () => {
  const { resultado, siguiente } = aplicarEtiquetaMasiva({ id: 1, tags: ['Moroso'] }, 'remove', 'MOROSO');
  assert.equal(resultado.actualizado, true);
  // `Prisma.DbNull` (NULL de SQL), NO `[]`: es la MISMA traducción de `tagsParaPrisma` que usan
  // el alta y la edición — «ausente ≠ vacío» (tagsDelCliente.ts).
  assert.deepEqual(siguiente, Prisma.DbNull, '🔴 quitar la única etiqueta debe dejar NULL, no `[]`');
});

test('remove · un cliente que NO la tiene no se toca', () => {
  const { resultado, siguiente } = aplicarEtiquetaMasiva({ id: 1, tags: ['moroso'] }, 'remove', 'urgente');
  assert.equal(resultado.actualizado, false);
  assert.equal(resultado.motivo, 'No la tenía');
  assert.equal(siguiente, null);
});

test('remove · un cliente sin etiquetas no revienta', () => {
  const { resultado } = aplicarEtiquetaMasiva({ id: 1, tags: null }, 'remove', 'lo-que-sea');
  assert.equal(resultado.actualizado, false);
  assert.equal(resultado.motivo, 'No la tenía');
});

test('el `id` del resultado es siempre el del cliente que entró, para poder mapear la respuesta', () => {
  const { resultado } = aplicarEtiquetaMasiva({ id: 42, tags: null }, 'add', 'x');
  assert.equal(resultado.id, 42);
});
