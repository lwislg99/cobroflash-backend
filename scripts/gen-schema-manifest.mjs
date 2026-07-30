// scripts/gen-schema-manifest.mjs — SCRUM-222 · DERIVA-PROD-1
//
// Regenera prisma/schema-manifest.json desde el DMMF del cliente de Prisma. El fichero es VERSIONADO
// (se ve en el diff del PR: quien añade una columna ve cambiar el manifiesto) y en producción se LEE
// como fichero plano — el runtime nunca necesita el DMMF (por eso no depende de si Railway lo genera).
//
//   node scripts/gen-schema-manifest.mjs
//
// El guard tests/scrum222-manifest.test.mjs exige que lo commiteado == lo que sale de aquí, así que
// tras tocar el schema hay que regenerar (o el guard sale rojo, que es justo el punto: dos listas
// atadas por un guard, no una lista que deriva en silencio).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { construirManifiesto } from './_schema-manifest.mjs';

const require = createRequire(import.meta.url);
const { Prisma } = require('@prisma/client');

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'prisma', 'schema-manifest.json');

const manifiesto = construirManifiesto(Prisma.dmmf);
fs.writeFileSync(DESTINO, JSON.stringify(manifiesto, null, 2) + '\n');
const nCols = Object.values(manifiesto).reduce((a, c) => a + c.length, 0);
console.log(`✓ ${path.relative(RAIZ, DESTINO)} — ${Object.keys(manifiesto).length} tablas, ${nCols} columnas`);
