// tests/scrum1214-clasificador-apretado.test.mjs — SCRUM-1214
//
// `_clasificador-sql.mjs` es el CONSEJERO del SQL que se pega a mano en staging y producción. El
// 28-sep-2026 se midió que admitía 10 formas que el guarda de dev (`_aplicar-sql-dev.mjs`) rechaza,
// y que a cuatro de ellas les ponía una etiqueta FALSA: `ADD CONSTRAINT … FOREIGN KEY / CHECK /
// UNIQUE` y `ADD PRIMARY KEY` salían como «ADD COLUMN ×1 — solo añade columnas». A quien estaba a
// punto de pegar una clave ajena en producción, el informe le decía que iba a añadir una columna.
//
// Javier autorizó apretar («Sí aprieta»). Se aprietan 8 de las 10. Las otras dos, `ALTER TYPE …
// ADD VALUE` y `COMMENT ON`, NO se tocan: son decisiones escritas de SCRUM-395
// (`scrum395-preflight-migracion.test.mjs`), y cambiarlas es otra decisión.
//
// ⛔ No se unifica con la lista de dev, y las dos diferencias deliberadas de dev (`DROP DEFAULT` de
// SCRUM-797 y `ADD COLUMN NOT NULL` sin DEFAULT) se quedan como están. Apretar no es igualar.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificarSentencia, clasificarFichero, desnudar, PERMITIDA, RECHAZADA } from '../scripts/_clasificador-sql.mjs';

/** Como la ve `clasificarFichero`: desnuda y sin el `;` final. */
const ver = (sql) => clasificarSentencia(desnudar(sql).desnudo.replace(/;\s*$/, ''));

// ── ① EL ETIQUETADO FALSO ─────────────────────────────────────────────────────────────────
const RESTRICCIONES = [
  ['ALTER TABLE "t" ADD CONSTRAINT "t_fk" FOREIGN KEY ("m") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;', /CONSTRAINT|FOREIGN KEY/],
  ['ALTER TABLE "invoices" ADD CONSTRAINT "chk" CHECK ("total" > 0);', /CONSTRAINT|CHECK/],
  ['ALTER TABLE "invoices" ADD CONSTRAINT "u" UNIQUE ("numero");', /CONSTRAINT|UNIQUE/],
  ['ALTER TABLE "invoices" ADD PRIMARY KEY ("id");', /PRIMARY KEY/],
  ['ALTER TABLE "invoices" ADD FOREIGN KEY ("m") REFERENCES "merchants"("id");', /FOREIGN KEY/],
  ['ALTER TABLE "invoices" ADD UNIQUE ("numero");', /UNIQUE/],
  ['ALTER TABLE "invoices" ADD CHECK ("total" > 0);', /CHECK/],
];

test('SCRUM-1214 · ① 🔴 una restricción NUNCA se etiqueta como «añade columnas»', () => {
  // Hermano del token (SCRUM-237): un ADD COLUMN legítimo SÍ lleva este motivo — así el
  // `doesNotMatch` de abajo comprueba un texto que el clasificador emite de verdad, no uno
  // imposible (la clase de bug de scrum73).
  assert.match(ver('ALTER TABLE "t" ADD COLUMN "c" TEXT;').motivo, /solo añade columnas/,
    '🔴 el motivo de un ADD COLUMN legítimo dejó de ser «solo añade columnas» — actualiza también el `doesNotMatch` de abajo.');
  for (const [sql, nombre] of RESTRICCIONES) {
    const c = ver(sql);
    assert.doesNotMatch(String(c.forma), /ADD COLUMN/,
      `🔴 ETIQUETA FALSA: «${sql.slice(0, 70)}» sale como «${c.forma}». Es una restricción, no una columna.`);
    assert.doesNotMatch(String(c.motivo), /solo añade columnas/,
      `🔴 MOTIVO FALSO para «${sql.slice(0, 70)}»: «${c.motivo}».`);
    assert.match(`${c.forma} ${c.motivo}`, nombre, `🔴 el informe no nombra lo que es: «${c.forma} — ${c.motivo}»`);
  }
});

test('SCRUM-1214 · ①② las restricciones añadidas a una tabla existente se RECHAZAN', () => {
  for (const [sql] of RESTRICCIONES) {
    assert.equal(ver(sql).veredicto, RECHAZADA,
      `🔴 PASA «${sql.slice(0, 70)}»: valida la tabla entera y toma bloqueos; el guarda de dev la rechaza.`);
  }
  // Y dentro de un ALTER con varias acciones tampoco se cuela detrás de una columna buena.
  assert.equal(ver('ALTER TABLE "t" ADD COLUMN "c" TEXT, ADD CONSTRAINT "u" UNIQUE ("c");').veredicto, RECHAZADA,
    '🔴 una restricción se coló detrás de un ADD COLUMN en el mismo ALTER TABLE.');
});

// ── ② LAS OTRAS 4 DE LAS 8 ────────────────────────────────────────────────────────────────
test('SCRUM-1214 · ② CREATE TABLE … AS SELECT y los CREATE TYPE que no son enum se RECHAZAN', () => {
  const casos = [
    ['CREATE TABLE "copia" AS SELECT * FROM "invoices";', 'AS SELECT copia datos'],
    ['CREATE TABLE IF NOT EXISTS "copia" AS SELECT * FROM "invoices";', 'AS SELECT con IF NOT EXISTS'],
    ['CREATE TYPE "c" AS ("a" INT, "b" TEXT);', 'tipo compuesto'],
    ['CREATE TYPE "r" AS RANGE (SUBTYPE = int4);', 'tipo rango'],
    ['CREATE TYPE "s";', 'tipo shell'],
    ['CREATE TYPE "b" (INPUT = f, OUTPUT = g);', 'tipo base (ejecuta funciones)'],
    [`CREATE TYPE "x" AS ENUM (lower('a'));`, 'algo que no es un literal dentro del enum'],
  ];
  for (const [sql, porque] of casos) {
    assert.equal(ver(sql).veredicto, RECHAZADA, `🔴 PASA (${porque}): «${sql}»`);
  }
});

test('SCRUM-1214 · lo mismo llamando a `clasificarSentencia` A PELO (con comillas y literales), que es pública', () => {
  // Por `clasificarFichero` la sentencia llega desnuda; a pelo, no. scrum395 la llama a pelo, y la
  // primera versión de este arreglo sólo entendía la desnuda: lo cazó su lista de «buenas».
  for (const [sql] of RESTRICCIONES) assert.equal(clasificarSentencia(sql.replace(/;$/, '')).veredicto, RECHAZADA, `🔴 a pelo PASA: ${sql}`);
  for (const sql of ['CREATE TABLE "copia" AS SELECT * FROM "invoices"', 'CREATE TYPE "c" AS ("a" INT)', 'CREATE TYPE "s"'])
    assert.equal(clasificarSentencia(sql).veredicto, RECHAZADA, `🔴 a pelo PASA: ${sql}`);
  for (const sql of [`CREATE TYPE "E" AS ENUM ('a', 'b')`, `CREATE TYPE "public"."E" AS ENUM ('a')`, 'CREATE TABLE "public"."t" ("id" INT)'])
    assert.equal(clasificarSentencia(sql).veredicto, PERMITIDA, `🔴 a pelo se bloqueó una aditiva: ${sql}`);
});

// ── LO QUE NO SE MUEVE ────────────────────────────────────────────────────────────────────
// Línea base medida el 28-sep-2026 sobre `origin/main` f9dc44a3, ANTES de tocar el clasificador.
// Si al apretar cambia el veredicto o la etiqueta de cualquiera de éstas, se cambió de más.
const LINEA_BASE = [
  ['DROP TABLE "invoices";', RECHAZADA, 'DROP'],
  ['ALTER TABLE "invoices" DROP COLUMN "total";', RECHAZADA, 'DROP'],
  ['TRUNCATE "invoices";', RECHAZADA, 'TRUNCATE'],
  ['DELETE FROM "invoices";', RECHAZADA, 'DELETE'],
  ['UPDATE "invoices" SET "total" = 0;', RECHAZADA, 'UPDATE'], // SCRUM-1223: etiqueta (era DESCONOCIDA); veredicto igual
  ['ALTER TABLE "invoices" RENAME COLUMN "total" TO "x";', RECHAZADA, 'RENAME'],
  ['ALTER TABLE "invoices" ALTER COLUMN "total" TYPE TEXT;', RECHAZADA, 'ALTER COLUMN TYPE'],
  ['DROP TYPE "VfSubmissionStatus" CASCADE;', RECHAZADA, 'DROP'],
  ['ALTER TABLE "invoices" ALTER COLUMN "total" DROP NOT NULL;', RECHAZADA, 'ALTER COLUMN … DROP NOT NULL'], // SCRUM-1223: etiqueta (era DROP); veredicto igual
  ['ALTER TABLE "invoices" ADD COLUMN "x" TEXT;', PERMITIDA, 'ADD COLUMN ×1'],
  ['ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "x" TEXT;', PERMITIDA, 'ADD COLUMN ×1'],
  ['CREATE INDEX "i" ON "invoices"("x");', PERMITIDA, 'CREATE INDEX'],
  ['CREATE TABLE "t" ("id" SERIAL NOT NULL);', PERMITIDA, 'CREATE TABLE'],
  // Las que se quedan permitidas a propósito:
  [`CREATE TYPE "E" AS ENUM ('a', 'b');`, PERMITIDA, 'CREATE TYPE'],
  [`ALTER TYPE "E" ADD VALUE 'c';`, PERMITIDA, 'ALTER TYPE ADD VALUE'],      // SCRUM-395, no se toca
  [`COMMENT ON TABLE "invoices" IS 'x';`, PERMITIDA, 'COMMENT ON'],           // SCRUM-395, no se toca
  ['ALTER TABLE "invoices" ADD COLUMN "y" INTEGER NOT NULL DEFAULT 0;', PERMITIDA, 'ADD COLUMN ×1'],
  ['ALTER TABLE "products" ADD COLUMN "a" TEXT, ADD COLUMN "b" TEXT;', PERMITIDA, 'ADD COLUMN ×2'],
  ['CREATE UNIQUE INDEX "u2" ON "invoices"("numero");', PERMITIDA, 'CREATE INDEX'],
  // Las dos diferencias deliberadas del lado de dev siguen RECHAZADAS aquí (no se iguala):
  ['ALTER TABLE "customers" ALTER COLUMN "merchant_id" DROP DEFAULT;', RECHAZADA, 'ALTER COLUMN … DROP DEFAULT'], // SCRUM-1223: etiqueta (era DROP); veredicto igual
  ['ALTER TABLE "invoices" ADD COLUMN "y" INTEGER NOT NULL;', RECHAZADA, 'ADD COLUMN NOT NULL sin DEFAULT'],
];

test('SCRUM-1214 · 🔴 CONTROL: las destructivas, las aditivas y las decisiones previas NO se mueven', () => {
  for (const [sql, veredicto, forma] of LINEA_BASE) {
    const c = ver(sql);
    assert.equal(c.veredicto, veredicto, `🔴 cambió el VEREDICTO de «${sql}»: ${c.veredicto} (era ${veredicto}). Se apretó de más.`);
    assert.equal(c.forma, forma, `🔴 cambió la ETIQUETA de «${sql}»: «${c.forma}» (era «${forma}»).`);
  }
});

test('SCRUM-1214 · el SQL real de la casa sigue pasando: el DDL de 1127 (enum + tablas + FK en línea)', () => {
  const sql = `CREATE TYPE "VfSubmissionStatus" AS ENUM ('pending', 'sent', 'accepted', 'rejected', 'manual_review');
CREATE TABLE "vf_submissions" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    CONSTRAINT "vf_submissions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "vf_submissions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "vf_submissions_merchant_id_idx" ON "vf_submissions"("merchant_id");`;
  const r = clasificarFichero(sql);
  assert.equal(r.ok, true, `🔴 se bloqueó SQL aditivo real: ${r.rechazadas.map((s) => s.motivo).join(' · ')}`);
  assert.equal(r.sentencias.length, 3);
});
