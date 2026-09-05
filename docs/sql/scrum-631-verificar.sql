-- docs/sql/scrum-631-verificar.sql — SCRUM-631 · antes y después, con SUELO dentro.
--
-- 🔴 `control_ve_los_indices` ES EL SUELO. Si sale 0, entonces `indice_parcial = 0` NO significa
--    «no se creó»: significa que esta consulta no está mirando esta tabla. Sin el suelo, los dos
--    ceros se escriben igual y significan lo contrario.
--    Esperado: control >= 2 (la clave primaria y la unicidad del nombre, en el estado que sea).
--
-- ⚠️ SE PREGUNTA POR PROPIEDAD, NUNCA POR EL NOMBRE DEL ÍNDICE (regla de la casa): `indisunique`
--    y `indpred IS NOT NULL` describen lo que el índice HACE. Un nombre es lo que alguien recuerda.

SELECT
  -- SUELO: ¿estoy viendo los índices de products?
  (SELECT count(*) FROM pg_index ix
     JOIN pg_class t ON t.oid = ix.indrelid
    WHERE t.relname = 'products')                              AS control_ve_los_indices,

  -- ¿está el índice TOTAL que causa el callejón? (1 = el callejón sigue)
  (SELECT count(*) FROM pg_index ix
     JOIN pg_class t ON t.oid = ix.indrelid
    WHERE t.relname = 'products'
      AND ix.indisunique AND ix.indpred IS NULL
      AND ix.indnatts = 2)                                     AS indice_total_unico,

  -- ¿está el índice PARCIAL de la opción B? (1 = aplicada)
  (SELECT count(*) FROM pg_index ix
     JOIN pg_class t ON t.oid = ix.indrelid
    WHERE t.relname = 'products'
      AND ix.indisunique AND ix.indpred IS NOT NULL)           AS indice_parcial,

  -- 🔴 EL BLOQUEANTE DEL PASO PREVIO: filas ACTIVAS que ya comparten nombre. Tiene que ser 0
  --    antes de crear el índice parcial, o el CREATE falla.
  (SELECT count(*) FROM (
      SELECT merchant_id, name_search
        FROM products
       WHERE is_active = true AND name_search IS NOT NULL
       GROUP BY merchant_id, name_search
      HAVING count(*) > 1) d)                                  AS activos_duplicados,

  -- CONTEXTO: cuántos nombres están presos hoy (filas inactivas con nombre).
  (SELECT count(*) FROM products
    WHERE is_active = false AND name_search IS NOT NULL)       AS nombres_presos,

  -- ⚠️ Y LOS QUE ESCAPAN A LA RESTRICCIÓN: `name_search` NULL no choca con nadie en Postgres.
  --    Medido el 5-sep-2026 en dev: los 8 productos sembrados están aquí (seed-demo.mjs:227 no
  --    escribe la columna), así que esa base NO ejercita la unicidad.
  (SELECT count(*) FROM products WHERE name_search IS NULL)    AS sin_name_search;
