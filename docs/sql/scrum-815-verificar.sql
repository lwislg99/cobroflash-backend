-- docs/sql/scrum-815-verificar.sql — SCRUM-815 · la comprobación, APARTE del DDL
--
-- Va en su propio fichero por la lección de SCRUM-650: el clasificador del aplicador rechaza un
-- `SELECT` dentro de un fichero de DDL, así que mezclarlos deja el `CREATE TABLE` sin ejecutarse.
--
-- ORDEN: ⓪ se corre **ANTES** del DDL. ①, ②, ③ y ④, después.
-- Sólo lectura: ni una escritura en todo el fichero.

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ⓪ EL SUELO DEL PROPIO GUION · se corre LA PRIMERA y no depende de ningún nombre de columna
--
-- 🔴 POR QUÉ EXISTE: las consultas de abajo escriben nombres físicos —`processed_at`,
-- `event_id`…— y **un guion que da por buenos sus propios nombres de columna es un instrumento que
-- no se ha probado a sí mismo**. Esto los lee de la base en vez de suponerlos.
--
-- Aquí hace además de comprobación previa: la tabla es NUEVA, así que **ANTES del DDL esto tiene
-- que devolver CERO FILAS**.
--
-- 🔴 SE PARA SI devuelve alguna fila antes de aplicar: `gateway_events` ya existe con otra forma, y
-- `CREATE TABLE IF NOT EXISTS` **no fallaría** — se quedaría callado dejando la tabla vieja, con
-- las columnas que tuviera. Ése es el modo de fallo silencioso que este ⓪ está aquí para impedir.
--
-- Medido el 8-sep-2026 sobre `origin/main` = 61d14a15: 0 coincidencias de `gateway_events` en
-- `docs/sql/deriva-prod.sql`, que se escribió contra la base real. Se espera que siga así.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'gateway_events'
ORDER BY ordinal_position;

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ① DESPUÉS DEL DDL · ¿existe la tabla con las OCHO columnas y la forma pactada?
--
-- Se esperan EXACTAMENTE 8 filas, y estas cuatro condiciones son las que decide el ticket:
--
--    received_at   → is_nullable = NO  · column_default = CURRENT_TIMESTAMP · precisión 3
--    processed_at  → is_nullable = YES · column_default = NULL              · precisión 3
--    attempts      → is_nullable = NO  · column_default = 1
--    last_error    → is_nullable = YES · character_maximum_length = 500
--
-- 🔴 SI `processed_at` SALE `NO` (not null) O CON DEFAULT, **el DDL está mal aplicado y hay que
-- pararlo**: sin el NULL no se puede distinguir «en curso» de «terminado», que es exactamente el
-- defecto que esta tabla viene a cerrar. Sería el booleano con otro nombre.
SELECT
  column_name,
  data_type,
  character_maximum_length,
  datetime_precision,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'gateway_events'
ORDER BY ordinal_position;

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ② DESPUÉS DEL DDL · el UNIQUE existe y es sobre las DOS columnas, en ese orden
--
-- 🔴 Es EL MECANISMO, no un adorno: es lo que hace imposible que dos réplicas procesen el mismo
-- evento a la vez. Si faltara, la tabla existiría y no serviría para nada — y todo lo demás
-- seguiría en verde, que es la peor forma de no funcionar.
--
-- Se esperan DOS filas: el índice único `gateway_events_provider_event_id_key` (is_unique = true)
-- y el normal `gateway_events_provider_processed_at_idx` (is_unique = false).
--
-- ⚠️ Se pregunta por PROPIEDAD (columnas y unicidad), no sólo por el NOMBRE: un índice que se
-- llame igual y no sea único dejaría esto en verde sin garantizar nada — la lección de
-- `unicidadNombreProducto.ts` (SCRUM-631).
SELECT
  i.relname                                   AS indice,
  ix.indisunique                              AS is_unique,
  array_agg(a.attname ORDER BY k.ord)         AS columnas
FROM pg_class t
JOIN pg_index ix         ON ix.indrelid = t.oid
JOIN pg_class i          ON i.oid = ix.indexrelid
JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_attribute a      ON a.attrelid = t.oid AND a.attnum = k.attnum
WHERE t.relname = 'gateway_events'
GROUP BY i.relname, ix.indisunique
ORDER BY ix.indisunique DESC, i.relname;

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ③ DESPUÉS DEL DDL · la tabla nace VACÍA
--
-- Se espera: total = 0. No hay backfill y no es un olvido: los eventos que Stripe ya entregó no se
-- pueden reconstruir, y ninguno de ellos está pendiente — el webhook de hoy los contestó.
--
-- Las otras dos columnas van al lado para que, cuando empiece a llenarse, esta misma consulta sea
-- la que dice si algo se está quedando atascado: `en_curso_o_muertos` creciendo y sin bajar es el
-- síntoma de un evento que nunca termina.
SELECT
  count(*)                                            AS total,
  count("processed_at")                               AS terminados,
  count(*) - count("processed_at")                    AS en_curso_o_muertos
FROM "gateway_events";

-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ④ DESPUÉS DEL DDL · nada de lo que había ha dejado de funcionar
--
-- Es aditivo: crea una tabla y no toca ninguna existente. Se comprueba en vez de afirmarlo,
-- mirando que las tablas del camino del cobro siguen ahí y siguen respondiendo.
--
-- Se espera: las tres filas, con los recuentos que tuviera la base antes del DDL.
SELECT 'charges'  AS tabla, count(*) AS filas FROM "charges"
UNION ALL
SELECT 'invoices' AS tabla, count(*) AS filas FROM "invoices"
UNION ALL
SELECT 'merchants' AS tabla, count(*) AS filas FROM "merchants";
