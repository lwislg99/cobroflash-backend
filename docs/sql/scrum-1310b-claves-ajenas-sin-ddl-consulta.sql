-- docs/sql/scrum-1310b-claves-ajenas-sin-ddl-consulta.sql — SCRUM-1310b (24-oct-2026)
--
-- ¿QUÉ DDL TIENEN DE VERDAD LAS 13 CLAVES AJENAS QUE NINGÚN FICHERO DEL REPOSITORIO ESCRIBE?
-- Decisión del fundador: SCRUM-1310 c.20776 («Sí, solo las 13»). Medición: c.20753.
--
-- ES DE SOLO LECTURA. Un único SELECT sobre `pg_constraint`, `pg_class`, `pg_namespace` y
-- `pg_attribute`: no escribe, no bloquea, no crea nada. Se pega en la consola de Postgres
-- (Railway → base → Query), en dev, en staging y en producción. Lo corre Javier.
--
-- ⚠️ VIVE EN UN FICHERO APARTE A PROPÓSITO: el aplicador (`scripts/_clasificador-sql.mjs`) rechaza
-- un SELECT, igual que en `verificacion-deriva-produccion.sql`. Esto NO es una migración.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 POR QUÉ SE BUSCAN POR TABLA Y COLUMNA, Y NO POR NOMBRE
--
--   1 · El nombre que implica el esquema (`<tabla>_<columna>_fkey`) es una SUPOSICIÓN: el límite
--       declarado de la medición del 1-oct. Si en una base la restricción se llama de otra forma,
--       buscar por nombre diría «falta» sin faltar. Por tabla y columna sale con su nombre REAL.
--   2 · En este fichero no se escribe el nombre de ninguna de las 13. La sonda de
--       `docs/master/evidencias/SCRUM-1550/sondas.json` busca el nombre de la de `rectifies` como
--       SUBCADENA en `docs/sql` y da por hecho el DDL si lo encuentra: con el nombre escrito aquí,
--       una consulta habría pasado por un DDL. Lo vigila `tests/scrum1310b-claves-ajenas-con-ddl.test.mjs`.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- CÓMO SE LEE — 14 filas, y la PRIMERA va antes que todo
--
--   orden 0 · CONTROL POSITIVO. Es `quotes_chargeId_fkey`, una de las 24 que SÍ tienen DDL
--             (congelada `20251104175333_add_quote_model/migration.sql:26`). Su `ddl` lo arma
--             esta consulta con las mismas piezas que las otras 13, y se compara con la línea del
--             fichero copiada aquí abajo, byte a byte.
--               · `CONTROL IDÉNTICO AL FICHERO`  → la consulta sabe escribir el DDL. Se sigue.
--               · `CONTROL DISTINTO`             → NADA de lo demás vale: o la base no es la que
--                 se cree, o la consulta escribe otra cosa. Mira la columna `pg_def` y para.
--               · `CONTROL NO ENCONTRADO`        → esta sesión no ve las tablas de la aplicación
--                 (otro `search_path`). Las 13 de abajo dirían «falta» sin faltar. Para.
--   orden 1–13 · LAS 13. Cada fila dice:
--               · `restriccion_real`, `on_delete`, `on_update` y `ddl` → lo que hay que pasar a
--                 `docs/sql/` (la siguiente sesión copia la columna `ddl` tal cual).
--               · `pg_def` → el texto que da Postgres (`pg_get_constraintdef`). Es un segundo
--                 testigo: si trae algo que `ddl` no tiene (`DEFERRABLE`, `NOT VALID`,
--                 `MATCH FULL`), se dice en el PR.
--               · `veredicto`:
--                   `HAY CLAVE AJENA`                         → bien.
--                   `HAY CLAVE AJENA, CON OTRO NOMBRE`        → existe, y el nombre real NO es el
--                                                               que implica el esquema. Se copia
--                                                               el real; el trinquete compara por
--                                                               nombre, así que hay que decirlo.
--                   `NO HAY CLAVE AJENA EN ESTA BASE`         → la columna no tiene ninguna. Es un
--                                                               hallazgo, no un DDL que copiar.
--                   (dos filas con el mismo `orden`)          → hay DOS claves sobre esa columna.
--
-- ALCANCE DECLARADO: solo claves ajenas de UNA columna (las 13 lo son), solo el esquema
-- `current_schema()`. NO mira índices, tipos, defaults ni `CREATE TABLE` (c.20776: alcance mínimo).
-- Lo que no mira, no lo afirma.
-- ═════════════════════════════════════════════════════════════════════════════════════════

WITH esperadas (orden, tabla, columna) AS (
  VALUES
    -- ── CONTROL POSITIVO · una de las 24 con DDL en fichero ──
    (0,  'quotes',          'chargeId'),
    -- ── LAS 13 SIN DDL EN NINGÚN FICHERO (c.20753 §2) ──
    (1,  'auth_sessions',   'merchant_id'),
    (2,  'auth_sessions',   'team_member_id'),
    (3,  'customers',       'merchant_id'),
    (4,  'invoices',        'rectifies_id'),
    (5,  'expenses',        'merchant_id'),
    (6,  'expenses',        'quote_id'),
    (7,  'expenses',        'provider_id'),
    (8,  'quote_requests',  'merchant_id'),
    (9,  'quote_requests',  'customer_id'),
    (10, 'quote_templates', 'merchant_id'),
    (11, 'team_members',    'merchant_id'),
    (12, 'customer_events', 'merchant_id'),
    (13, 'customer_events', 'customer_id')
),
-- La línea del fichero, copiada byte a byte de la congelada (ver arriba). Es el control.
fichero_control (ddl) AS (
  VALUES ('ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "public"."charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;')
),
claves AS (
  SELECT
    c.oid,
    c.conname,
    n.nspname                                   AS esquema,
    t.relname                                   AS tabla,
    rn.nspname                                  AS esquema_ref,
    rt.relname                                  AS tabla_ref,
    (SELECT string_agg('"' || a.attname || '"', ', ' ORDER BY k.ord)
       FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum)
                                                AS columnas,
    (SELECT string_agg('"' || a.attname || '"', ', ' ORDER BY k.ord)
       FROM unnest(c.confkey) WITH ORDINALITY AS k(attnum, ord)
       JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.attnum)
                                                AS columnas_ref,
    CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
                       WHEN 'n' THEN 'SET NULL'  WHEN 'd' THEN 'SET DEFAULT' END AS on_delete,
    CASE c.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
                       WHEN 'n' THEN 'SET NULL'  WHEN 'd' THEN 'SET DEFAULT' END AS on_update,
    array_length(c.conkey, 1)                   AS n_columnas,
    pg_get_constraintdef(c.oid)                 AS pg_def
  FROM pg_constraint c
  JOIN pg_class      t  ON t.oid  = c.conrelid
  JOIN pg_namespace  n  ON n.oid  = t.relnamespace
  JOIN pg_class      rt ON rt.oid = c.confrelid
  JOIN pg_namespace  rn ON rn.oid = rt.relnamespace
  WHERE c.contype = 'f'
    AND n.nspname = current_schema()
),
filas AS (
  SELECT
    e.orden, e.tabla, e.columna,
    k.conname AS restriccion_real,
    k.on_delete, k.on_update,
    'ALTER TABLE "' || k.esquema || '"."' || k.tabla || '" ADD CONSTRAINT "' || k.conname
      || '" FOREIGN KEY (' || k.columnas || ') REFERENCES "' || k.esquema_ref || '"."' || k.tabla_ref
      || '"(' || k.columnas_ref || ') ON DELETE ' || k.on_delete || ' ON UPDATE ' || k.on_update || ';'
      AS ddl,
    k.pg_def
  FROM esperadas e
  LEFT JOIN claves k
    ON k.tabla = e.tabla AND k.n_columnas = 1 AND k.columnas = '"' || e.columna || '"'
)
SELECT
  f.orden,
  f.tabla,
  f.columna,
  f.restriccion_real,
  f.on_delete,
  f.on_update,
  f.ddl,
  f.pg_def,
  CASE
    WHEN f.orden = 0 AND f.restriccion_real IS NULL           THEN 'CONTROL NO ENCONTRADO'
    WHEN f.orden = 0 AND f.ddl = (SELECT ddl FROM fichero_control) THEN 'CONTROL IDÉNTICO AL FICHERO'
    WHEN f.orden = 0                                          THEN 'CONTROL DISTINTO'
    WHEN f.restriccion_real IS NULL                           THEN 'NO HAY CLAVE AJENA EN ESTA BASE'
    WHEN f.restriccion_real <> f.tabla || '_' || f.columna || '_fkey'
                                                              THEN 'HAY CLAVE AJENA, CON OTRO NOMBRE'
    ELSE 'HAY CLAVE AJENA'
  END AS veredicto
FROM filas f
ORDER BY f.orden, f.restriccion_real;
