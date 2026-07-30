// GUARD · EL MANIFIESTO VERSIONADO == EL SCHEMA. — SCRUM-222 · DERIVA-PROD-1
//
// `prisma/schema-manifest.json` es la lista de columnas que el código EXIGE, congelada en el repo.
// El assert de arranque (SCRUM-222) la compara contra la BD viva de producción. Si el manifiesto
// DERIVA del schema en silencio, el assert compararía contra una verdad vieja — la clase de lista a
// mano sin guard que esta casa lleva cerrando (backup SCRUM-241, wipeDemo, etc.).
//
// Este guard ata las dos: regenera el manifiesto en memoria desde el DMMF y exige que == el fichero
// commiteado. Quien toca el schema y no corre `node scripts/gen-schema-manifest.mjs` sale ROJO, y lo
// ve en el diff del PR. Sin BD: corre en `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { construirManifiesto } from '../scripts/_schema-manifest.mjs';

const require = createRequire(import.meta.url);
const { Prisma } = require('@prisma/client');
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUTA = path.join(RAIZ, 'prisma', 'schema-manifest.json');

test('SCRUM-222 · SUELO: el manifiesto derivado del schema no sale vacío', () => {
  const derivado = construirManifiesto(Prisma.dmmf);
  assert.ok(Object.keys(derivado).length >= 20,
    `🔴 solo ${Object.keys(derivado).length} tablas derivadas: DMMF vacío o roto (¿cliente sin generar?)`);
  assert.ok(derivado.merchants?.length, '🔴 merchants sin columnas: el detector no ve el schema');
});

test('SCRUM-222 · el manifiesto versionado coincide con el schema (regenéralo si falla)', () => {
  const versionado = JSON.parse(fs.readFileSync(RUTA, 'utf8'));
  const derivado = construirManifiesto(Prisma.dmmf);
  assert.deepEqual(
    versionado, derivado,
    '\n\n🔴 prisma/schema-manifest.json NO coincide con el schema (DMMF).\n'
    + '   Alguien tocó el schema y no regeneró el manifiesto.\n'
    + '   Arreglo:  node scripts/gen-schema-manifest.mjs\n'
    + '   Este fichero es lo que el assert de arranque (SCRUM-222) compara contra la BD viva de prod;\n'
    + '   si deriva del schema en silencio, el assert mira una verdad vieja y la protección se evapora.',
  );
});
