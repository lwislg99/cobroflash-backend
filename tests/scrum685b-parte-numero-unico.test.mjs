// tests/scrum685b-parte-numero-unico.test.mjs — SCRUM-685b · el número del parte, único por merchant.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LO QUE ESTE FICHERO **NO** PRUEBA, DICHO PRIMERO
//
// Que la base acepte un duplicado sin el índice y lo rechace con él es una afirmación sobre
// PostgreSQL, y **no se puede comprobar desde aquí**: la suite corre sin base de datos. Un test
// que dijera «rechaza duplicados» sin una base delante estaría afirmando lo que no midió.
//
// SÍ SE MIDIÓ, contra un PostgreSQL 16.4 real (portátil, en el scratchpad, puerto 55432 — ninguna
// base del proyecto), el 3-sep-2026. Salida literal, resumida:
//
//     ② sin el índice, dos INSERT con el mismo (merchant_id, numero) →  INSERT 0 1 · INSERT 0 1
//        filas_con_pt_2026_001 = 2          ← LA BASE ACEPTÓ EL DUPLICADO
//     ④ con los duplicados dentro, CREATE UNIQUE INDEX →
//        ERROR: could not create unique index "partes_trabajo_merchant_id_numero_key"
//        DETAIL: Key (merchant_id, numero)=(1, PT-2026-001) is duplicated.
//     ⑥ limpiado y creado el índice, el MISMO INSERT que antes pasaba →
//        ERROR: duplicate key value violates unique constraint "partes_trabajo_merchant_id_numero_key"
//     ⑦ otro merchant con el mismo número → INSERT 0 1   ← el índice es POR merchant, no global
//
// La medición está en `docs/master/SCRUM-685.md`. Lo que este fichero vigila es lo que sí puede
// vigilar sin base: que la DECLARACIÓN y el SQL no se separen del hecho medido.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clasificarFichero, RECHAZADA } from '../scripts/_clasificador-sql.mjs';
// SCRUM-694: el filtro de comentarios NO se fabrica aquí. `soloCodigo` usa el escáner de
// TypeScript, que sabe distinguir un `//` dentro de una cadena de uno que abre comentario — y
// un regex a mano falla en los dos sentidos. Comprobado sobre el bloque de Prisma: conserva
// `@@unique` y los dos `@@index`, y borra las quince líneas que lo explican.
import { soloCodigo } from './_solo-codigo.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');

/** El bloque del modelo, sin comentarios. Atado AL BLOQUE, no al fichero. */
function modeloParteTrabajo() {
  const m = SCHEMA.match(/^model ParteTrabajo \{[\s\S]*?^\}/m);
  assert.ok(m, '🔴 SUELO: no encuentro `model ParteTrabajo` en el schema. Sin él, nada de lo de ' +
    'abajo significa nada: pasaría por no encontrar dónde mirar.');
  return soloCodigo(m[0], 'parteTrabajo.prisma');
}

test('SCRUM-685b · 🔴 el esquema DECLARA el índice único, no sólo lo comenta', () => {
  const bloque = modeloParteTrabajo();

  // 🔴 Sin comentarios a propósito: este mismo modelo lleva quince líneas de comentario
  // explicando POR QUÉ hace falta el `@@unique`. Buscando en el texto crudo, el guard casaría con
  // su propia explicación y pasaría en verde con la declaración borrada. Ya ha pasado dos veces
  // en esta casa.
  assert.match(bloque, /@@unique\(\[merchantId,\s*numero\]\)/,
    '🔴 `ParteTrabajo` ya no declara `@@unique([merchantId, numero])`.\n' +
    '   MEDIDO contra un Postgres real: sin ese índice la base ACEPTA dos partes con el mismo ' +
    'número dentro del mismo merchant, y quedan dos documentos distintos diciendo ser el mismo — ' +
    'el cliente firma uno y la oficina valora el otro.\n' +
    '   `siguienteNumeroParte` deriva del máximo ya emitido y NO puede impedirlo: dos creaciones ' +
    'simultáneas leen el mismo máximo.');

  // Los dos índices de SCRUM-674 siguen: el único no los sustituye.
  assert.match(bloque, /@@index\(\[merchantId,\s*fecha\]\)/, '🔴 se ha perdido el índice por fecha');
  assert.match(bloque, /@@index\(\[merchantId,\s*estado\]\)/, '🔴 se ha perdido el índice por estado');
});

test('SCRUM-685b · 🔴 el SQL usa EXACTAMENTE el nombre que genera Prisma', () => {
  // Con otro nombre, esquema y base tendrían el mismo índice llamado de dos formas, y el próximo
  // `migrate diff` propondría crear uno y BORRAR el otro. Comprobado con
  // `migrate diff --from-empty --to-schema-datamodel`: Prisma lo llama así.
  const sql = fs.readFileSync(path.join(RAIZ, 'docs', 'sql', 'scrum-685b-parte-numero-unico.sql'), 'utf8');
  const codigo = sql.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');

  assert.match(codigo, /CREATE UNIQUE INDEX IF NOT EXISTS "partes_trabajo_merchant_id_numero_key"/,
    '🔴 el nombre del índice no es el que genera Prisma (`partes_trabajo_merchant_id_numero_key`), ' +
    'o ha dejado de ser idempotente.');
  assert.match(codigo, /ON "partes_trabajo"\("merchant_id",\s*"numero"\)/,
    '🔴 el índice no es sobre (merchant_id, numero)');
});

test('SCRUM-685b · 🔴 el SQL del índice pasa el clasificador: 0 rechazadas, 0 borrados', () => {
  const sql = fs.readFileSync(path.join(RAIZ, 'docs', 'sql', 'scrum-685b-parte-numero-unico.sql'), 'utf8');
  const r = clasificarFichero(sql);
  const rechazadas = (r.rechazadas || []).filter((s) => s.veredicto === RECHAZADA);
  assert.equal(rechazadas.length, 0,
    '🔴 el fichero que se va a aplicar a las tres bases tiene sentencias rechazadas: ' +
    JSON.stringify(rechazadas.map((s) => s.forma)));
  assert.equal(r.ok, true, '🔴 el clasificador no da el fichero por aplicable');
  assert.equal((r.sentencias || []).length, 1,
    '🔴 el fichero del índice tiene ' + (r.sentencias || []).length + ' sentencias y debería ' +
    'tener UNA. Un fichero que se aplica a tres bases se lee entero antes de ejecutarlo.');
});

test('SCRUM-685b · el fichero de comprobación va APARTE, y eso es deliberado', () => {
  // El clasificador RECHAZA un `SELECT` por diseño —es una lista blanca de formas ADITIVAS— así
  // que meter la verificación en el mismo fichero que el `CREATE INDEX` dejaría el fichero
  // INAPLICABLE. Lo dice `docs/sql/verificacion-deriva-produccion.sql`: «ya pasó una vez; por eso
  // se separan». Este test fija la separación para que nadie los junte «por comodidad».
  const dir = path.join(RAIZ, 'docs', 'sql');
  assert.ok(fs.existsSync(path.join(dir, 'scrum-685b-comprobar-duplicados.sql')),
    '🔴 falta el fichero que comprueba duplicados ANTES de crear el índice.');

  const indice = fs.readFileSync(path.join(dir, 'scrum-685b-parte-numero-unico.sql'), 'utf8');
  const codigo = indice.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  assert.ok(!/\bSELECT\b/i.test(codigo),
    '🔴 el fichero del índice ha ganado un `SELECT`. El clasificador lo rechazaría y el fichero ' +
    'entero dejaría de poder aplicarse — con el `CREATE INDEX` dentro.');
});

test('SCRUM-685b · 🔴 el fichero dice que el ALTER va ANTES que el PR', () => {
  // El 2-sep el commit de esquema de SCRUM-674 entró en `main` con las columnas sin existir en
  // ninguna base. El orden no se recuerda solo: se escribe donde lo lee quien ejecuta.
  const sql = fs.readFileSync(path.join(RAIZ, 'docs', 'sql', 'scrum-685b-parte-numero-unico.sql'), 'utf8');
  assert.match(sql, /ANTES QUE EL PR|② antes que ③|ANTES de mergear el PR/,
    '🔴 el fichero no dice que se aplica ANTES de mergear el PR que declara el `@@unique`.');
  assert.match(sql, /dev.*staging.*producci/is,
    '🔴 no dice en qué orden de bases se aplica.');
});
