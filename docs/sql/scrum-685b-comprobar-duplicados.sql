-- docs/sql/scrum-685b-comprobar-duplicados.sql — SOLO LECTURA. Se ejecuta ANTES del índice único.
--
-- CÓMO SE USA: pegar en la consola de Postgres (Railway → base → Query), en cada base.
-- QUÉ SE HACE CON EL RESULTADO: si sale **0 filas** en el segundo bloque, se puede aplicar
--   `scrum-685b-parte-numero-unico.sql` en esa base. Si sale **≥1 fila**, PARAR: hay partes que
--   dicen ser el mismo documento, y qué hacer con ellos no lo decide este fichero.
--
-- NO ESCRIBE NADA: dos `SELECT` y ninguna otra cosa.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- POR QUÉ HAY QUE MIRAR ANTES
--
-- `CREATE UNIQUE INDEX` **falla** si ya existen duplicados. Descubrirlo con el error del índice
-- es descubrirlo tarde: el ALTER se queda a medias en esa base y hay que decidir a toda prisa.
--
-- Y puede haberlos de verdad, no es un trámite: `siguienteNumeroParte`
-- (`src/modules/jobs/domain/parteNumero.ts`) deriva el número del MÁXIMO ya emitido, y hasta que
-- exista este índice **nada impide** que dos creaciones simultáneas del mismo merchant acuñen el
-- mismo. Justamente por eso se crea el índice.
-- ═════════════════════════════════════════════════════════════════════════════════════════


-- ── ① CONTROL POSITIVO — leer esto ANTES que el bloque ② ─────────────────────────────────
--
-- 🔴 Si `control_ve_la_tabla` sale 0, el bloque ② NO significa «no hay duplicados»: significa que
-- la consulta no está mirando la tabla —otro `search_path`, o la tabla todavía no existe en esta
-- base—. Un 0 en ② sin un 1 en ① es CEGUERA, no limpieza.
--
-- Esperado tras aplicar `scrum-674-aditivo.sql`: control_ve_la_tabla = 1.

SELECT
  (SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'partes_trabajo')   AS control_ve_la_tabla,
  (SELECT count(*) FROM "partes_trabajo")                              AS partes_en_esta_base;


-- ── ② LOS DUPLICADOS ─────────────────────────────────────────────────────────────────────
--
-- Cada fila es un (merchant_id, numero) repetido, con cuántas veces aparece y los `id` concretos,
-- para poder mirarlos uno a uno sin volver a buscarlos.
--
--   0 filas  → se puede crear el índice único en esta base.
--   ≥1 fila  → PARAR y decidir. No se aplica el índice hasta resolverlos.

SELECT "merchant_id",
       "numero",
       count(*)                        AS veces,
       array_agg("id" ORDER BY "id")   AS ids
  FROM "partes_trabajo"
 GROUP BY "merchant_id", "numero"
HAVING count(*) > 1
 ORDER BY veces DESC, "merchant_id", "numero";
