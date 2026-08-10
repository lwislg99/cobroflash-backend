// scripts/generar-sql-deriva.mjs — SCRUM-222
//
// Genera `docs/sql/deriva-prod.sql`: UNA consulta de SOLO LECTURA, autocontenida, que el
// fundador pega en la consola de Postgres de Railway (producción) para responder «¿qué columnas
// declara el schema y NO existen en esa base?».
//
// POR QUÉ SE GENERA Y NO SE ESCRIBE A MANO. La consulta lleva dentro la lista de columnas
// esperadas (un VALUES grande — feo y correcto: es el precio de no depender de node ni del CLI
// de Prisma al otro lado). Una lista copiada a mano envejece en SILENCIO, y su forma de
// envejecer es la peor posible: al añadirse una columna nueva al schema, la consulta vieja no
// la pregunta y responde «0 filas» — o sea, **dice «en sync» justo sobre la columna que acaba
// de nacer**, que es exactamente el defecto que SCRUM-222 persigue. Por eso se genera del mismo
// DMMF que usa el arranque, y por eso `tests/scrum222-deriva-arranque.test.mjs` exige que el
// fichero commiteado coincida con lo que este script produce hoy.
//
// ESTE SCRIPT NO ABRE NINGUNA CONEXIÓN. Lee el DMMF (que es estático, viene del cliente
// generado) y escribe un fichero. No necesita `DATABASE_URL` ni turno de staging.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { comprobarProcedencia, mensaje } from './_prisma-procedencia-guard.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

/** Mismo criterio que `src/core/db/schemaDrift.ts`: `dbName ?? name`, y las relaciones fuera. */
export function paresEsperados(datamodel = require('@prisma/client').Prisma.dmmf.datamodel) {
  const pares = [];
  for (const m of datamodel.models) {
    const tabla = m.dbName ?? m.name;
    for (const f of m.fields) {
      if (f.kind === 'object') continue; // relación, no columna
      pares.push([tabla, f.dbName ?? f.name]);
    }
  }
  return pares.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
}

export function generarSql(pares = paresEsperados()) {
  for (const [t, c] of pares) {
    // Los identificadores viajan como LITERALES de cadena dentro del VALUES. Ninguno de este
    // schema lleva comilla, y si algún día la llevara habría que escaparla: mejor parar aquí
    // que emitir SQL roto —o algo peor— contra producción.
    if (t.includes("'") || c.includes("'")) throw new Error(`identificador con comilla: ${t}.${c}`);
  }
  const values = pares.map(([t, c]) => `    ('${t}','${c}')`).join(',\n');

  return `-- docs/sql/deriva-prod.sql — GENERADO por scripts/generar-sql-deriva.mjs (SCRUM-222).
-- NO editar a mano: hay un test que compara este fichero con el schema actual.
--
-- QUÉ RESPONDE: qué columnas declara el schema de YaQu y NO existen en ESTA base.
-- CÓMO SE USA: pegar entera en la consola de Postgres (Railway → base → Query/Data).
--
-- ES DE SOLO LECTURA. Un único SELECT sobre information_schema: no escribe, no bloquea, no
-- crea nada y no depende de node ni del CLI de Prisma.
--
-- CÓMO SE LEE EL RESULTADO
--   0 filas ............... la base tiene TODO lo que el código nombra. En sync.
--   filas .................. cada una es un hueco: falta esa columna en esta base.
--   falta_la_tabla_entera .. true → no es que falte la columna, es que no está la tabla.
--   columnas_vistas ........ el MISMO número en todas las filas: cuántas columnas se han
--                            leído del catálogo. **Si sale 0, el resultado NO significa «falta
--                            todo»: significa que no se pudo comprobar** — la sesión mira a un
--                            esquema que no es el de la app (otro search_path) o no se pudo
--                            leer information_schema. Es el mismo suelo anti-falso-positivo que
--                            lleva el chequeo de arranque, y está aquí por el mismo motivo:
--                            sin él, un search_path distinto se leería como deriva total.
--
-- ALCANCE (el mismo que el chequeo de arranque, declarado para que no se le suponga más):
-- comprueba que EXISTAN tabla y columna. NO mira tipos, nullability, defaults, índices, claves
-- ajenas ni valores de enum. Y no reporta columnas de MÁS en la base: que la base vaya por
-- delante del código es el orden seguro de un cambio aditivo, no un problema.
--
-- Columnas esperadas: ${pares.length}. Tablas: ${new Set(pares.map((p) => p[0])).size}.

WITH esperado (tabla, columna) AS (
  VALUES
${values}
),
catalogo AS (
  SELECT table_name::text AS tabla, column_name::text AS columna
  FROM information_schema.columns
  WHERE table_schema = current_schema()
)
SELECT
  e.tabla,
  e.columna,
  NOT EXISTS (SELECT 1 FROM catalogo c WHERE c.tabla = e.tabla) AS falta_la_tabla_entera,
  (SELECT count(*) FROM catalogo)                              AS columnas_vistas
FROM esperado e
WHERE NOT EXISTS (
  SELECT 1 FROM catalogo c WHERE c.tabla = e.tabla AND c.columna = e.columna
)
ORDER BY e.tabla, e.columna;
`;
}

export const RUTA_SQL = path.join(RAIZ, 'docs', 'sql', 'deriva-prod.sql');

/**
 * 🔴 SCRUM-461 · NO SE ESCRIBE CON EL CLIENTE ATRASADO.
 *
 * Ésta es la puerta por la que entró el incidente del 10-ago. `paresEsperados` lee el DMMF del
 * **cliente generado**, así que con un cliente viejo este script escribe un censo CORTO — y el
 * censo existe justo para detectar columnas que faltan. Uno encogido **deja de mirarlas** y pasa
 * en verde.
 *
 * Aquel día salió **331** en un worktree cuyo cliente iba cinco campos por detrás, contra **346**
 * del schema. Se evitó porque el fundador vio un número raro; con una columna en vez de quince,
 * nadie lo habría notado.
 *
 * ⚠️ Y POR QUÉ AQUÍ Y NO EN `pretest`: `_prisma-sync.mjs` ya corre antes de la tanda, así que
 * `npm test` se autoprotege. Este script lanzado **a mano** no pasa por ahí — y a mano es
 * exactamente como se lanzó.
 *
 * No se comprueba dentro de `paresEsperados` a propósito: los tests la importan con un datamodel
 * propio y esto los haría depender del entorno. Se comprueba al ESCRIBIR, que es lo que hace daño.
 */
export function motivoParaNoEscribir() {
  const r = comprobarProcedencia();
  return r.ok ? null : mensaje(r);
}

// Solo escribe si se ejecuta directamente; importado (desde el test) no toca disco.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const motivo = motivoParaNoEscribir();
  if (motivo) {
    console.error(motivo);
    console.error(
      '\n🔴 NO SE HA ESCRITO NADA. Este script deriva el censo del CLIENTE generado, así que con el\n' +
      '   cliente atrasado escribiría un censo CORTO — y un censo corto deja de vigilar justo las\n' +
      '   columnas que le faltan, en silencio. Regenera el cliente y vuelve a lanzarlo.',
    );
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(RUTA_SQL), { recursive: true });
  fs.writeFileSync(RUTA_SQL, generarSql(), 'utf8');
  console.log(`escrito ${path.relative(RAIZ, RUTA_SQL)} (${paresEsperados().length} columnas)`);
}
