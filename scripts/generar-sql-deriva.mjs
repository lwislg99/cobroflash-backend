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

// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 SCRUM-733 · «NO HAY ENTRADA» Y «NO SUPE LEERLA» NO PUEDEN DAR EL MISMO RESULTADO
//
// La puerta de SCRUM-461 cubre UNA causa de encogimiento —el cliente atrasado— y la cubre bien.
// Lo que no había es un suelo del PROPIO CENSO: medido el 4-sep-2026, `generarSql([])` escribe
// tan tranquilo un fichero de 48 líneas con `-- Columnas esperadas: 0` y un `VALUES` vacío, y el
// script sale con 0 diciendo «escrito … (0 columnas)».
//
// Y el modo de fallo importa: con CERO entradas el SQL ni siquiera es válido y Postgres protesta
// —ruidoso, se arregla—. Con POCAS es SQL perfectamente válido que devuelve **0 filas**, o sea
// «en sync», sobre una base a la que le falten justo las columnas que el censo ha dejado de
// preguntar. Es la mentira exacta que este fichero existe para impedir, y llegaría firmada por su
// propia cabecera.
//
// Que hoy no haya camino conocido para provocarlo NO es el motivo para no ponerlo: el guard de
// procedencia se protege de que `.prisma/client/schema.prisma` sea detalle interno de Prisma y
// pueda mudarse; `Prisma.dmmf.datamodel` es exactamente igual de interno —y la deprecación de
// `package.json#prisma` que ya avisa en cada `generate` dice que Prisma 7 viene—. Si un día ese
// DMMF llega vacío o a medias, hoy se escribe el censo corto y no lo dice nadie.
//
// ⚠️ EL SUELO VA EN LA ESCRITURA, NO EN `generarSql()`. Es la misma decisión que ya tomó
// `motivoParaNoEscribir` y por el mismo motivo: los tests llaman a `generarSql` con listas
// sintéticas de tres pares, y meterlo dentro los haría depender del entorno. Lo que hace daño es
// ESCRIBIR.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Lo que la cabecera del fichero DECLARA que hay. `null` si no lo dice. */
export function columnasDeclaradas(texto) {
  const m = String(texto).match(/^-- Columnas esperadas: (\d+)\./m);
  return m ? Number(m[1]) : null;
}

/**
 * Las entradas `('tabla','columna')` de un fichero ya escrito.
 *
 * 🔴 A PROPÓSITO MÁS TOLERANTE que el vigilante de `tests/scrum461-censo-no-encoge.test.mjs`, que
 * exige la línea EXACTA (`^ {4}\('a','b'\),?$`). Medido: a ese le basta un comentario SQL detrás
 * de una línea —o un espacio de más— para dejar de ver ESA entrada, y entonces da 421 donde hay
 * 422. Allí ese error GRITA (la entrada sale como «falta en el SQL» y el test cae). Aquí gritaría
 * al revés: se leería como que el censo se ENCOGE, y pararía una regeneración legítima por una
 * anotación de nadie. Por eso aquí se leen las entradas ESTÉN COMO ESTÉN.
 *
 * Y por eso mismo el lector lleva su propia comprobación: el fichero DECLARA en su cabecera
 * cuántas columnas tiene, así que se le puede preguntar a él. Si lo leído no cuadra con lo
 * declarado, se devuelve `ok: false` — «no supe leer este fichero», que NO es «este fichero tiene
 * pocas entradas». Confundir las dos es el defecto que este suelo viene a cerrar.
 *
 * @returns {{ ok: true, pares: [string,string][], declaradas: number|null }
 *         | { ok: false, motivo: string }}
 */
export function leerCensoDelFichero(texto) {
  const t = String(texto);
  const inicio = t.indexOf('VALUES');
  if (inicio < 0) return { ok: false, motivo: 'no encuentro el bloque `VALUES`: esto no parece el censo de deriva.' };
  const fin = t.indexOf('),\ncatalogo', inicio);
  const bloque = fin > inicio ? t.slice(inicio, fin) : t.slice(inicio);
  const pares = [...bloque.matchAll(/\('([^']*)','([^']*)'\)/g)].map((m) => [m[1], m[2]]);
  const declaradas = columnasDeclaradas(t);
  if (declaradas !== null && declaradas !== pares.length) {
    return {
      ok: false,
      motivo: `la cabecera declara ${declaradas} columnas y yo leo ${pares.length}. No supe leer este `
        + 'fichero, y un recuento en el que no confío no puede servir para decidir si el censo se ha '
        + 'encogido: diría lo contrario de lo que pasa.',
    };
  }
  return { ok: true, pares, declaradas };
}

/**
 * El suelo: ¿hay motivo para NO escribir este censo encima del que ya hay?
 *
 * @param {[string,string][]} pares          lo que se va a escribir
 * @param {string|null} textoEnDisco         el fichero actual, o `null` si no existe todavía
 * @param {{aceptaEncogimiento?: boolean}} opciones
 * @returns {string|null} el motivo, o `null` si puede escribirse
 */
export function motivoParaNoEncoger(pares, textoEnDisco, { aceptaEncogimiento = false } = {}) {
  // ① CERO NUNCA ES UN CENSO. No existe un schema sin columnas: si salen cero, lo que ha fallado
  //    es la lectura del DMMF, y el fichero resultante ni siquiera es SQL válido (`VALUES` vacío).
  if (!Array.isArray(pares) || pares.length === 0) {
    return '🔴 EL CENSO SALE VACÍO (0 columnas). Eso no es «el schema no declara columnas» —no existe '
      + 'tal schema—: es que no se ha podido leer el modelo de datos.\n'
      + '   Con cero entradas el SQL ni siquiera es válido; con pocas sería válido y respondería\n'
      + '   «0 filas» = «en sync» sobre una base a la que le falten justo las que dejó de preguntar.\n'
      + '   Regenera el cliente (`node_modules/.bin/prisma generate`) y vuelve a lanzarlo.';
  }
  if (textoEnDisco == null) return null;   // primera escritura: no hay con qué comparar

  const previo = leerCensoDelFichero(textoEnDisco);
  if (!previo.ok) {
    return '🔴 NO SUPE LEER EL FICHERO QUE YA HAY en ' + path.relative(RAIZ, RUTA_SQL) + ': ' + previo.motivo
      + '\n   No se escribe encima. Si el fichero está corrupto o a medias, bórralo y vuelve a lanzarlo:\n'
      + '   una primera escritura no tiene con qué compararse y no necesita permiso.';
  }

  const clave = (p) => p[0] + '.' + p[1];
  const ahora = new Set(pares.map(clave));
  const desaparecen = previo.pares.map(clave).filter((k) => !ahora.has(k)).sort();
  if (desaparecen.length === 0) return null;   // crecer o quedarse igual es lo normal
  if (aceptaEncogimiento) return null;

  return '🔴 EL CENSO SE ENCOGE: ' + desaparecen.length + ' entrada(s) que hoy están en '
    + path.relative(RAIZ, RUTA_SQL).replace(/\\/g, '/') + ' desaparecerían:\n'
    + desaparecen.map((k) => '     · ' + k).join('\n')
    + '\n\n   Una entrada que desaparece es una columna que el censo DEJA DE PREGUNTAR, y entonces\n'
    + '   responde «0 filas» —«en sync»— justo sobre ella. No se escribe.\n'
    + '   · Si es un descuido (cliente a medias, schema equivocado): arréglalo y vuelve a lanzarlo.\n'
    + '   · Si el encogimiento es DE VERDAD lo que quieres —se ha quitado un modelo del schema—,\n'
    + '     dilo a la cara:  node scripts/generar-sql-deriva.mjs --acepta-encogimiento';
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

  // SCRUM-733 · el suelo del censo, ANTES de tocar el disco.
  const pares = paresEsperados();
  const enDisco = fs.existsSync(RUTA_SQL) ? fs.readFileSync(RUTA_SQL, 'utf8').replace(/\r\n/g, '\n') : null;
  const noEncoger = motivoParaNoEncoger(pares, enDisco, {
    aceptaEncogimiento: process.argv.includes('--acepta-encogimiento'),
  });
  if (noEncoger) {
    console.error(noEncoger);
    console.error('\n🔴 NO SE HA ESCRITO NADA.');
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(RUTA_SQL), { recursive: true });
  fs.writeFileSync(RUTA_SQL, generarSql(pares), 'utf8');
  console.log(`escrito ${path.relative(RAIZ, RUTA_SQL)} (${pares.length} columnas)`);
}
