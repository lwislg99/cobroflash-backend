-- docs/sql/scrum-588-verificacion.sql — SCRUM-588 (CONT-16)
--
-- ¿TIENE ESTA BASE `customers.internal_ref`, Y CON EL TIPO QUE EL CÓDIGO NOMBRA?
--
-- SOLO LECTURA. Un único SELECT sobre `information_schema`: no escribe, no bloquea, no crea nada.
-- Se pega en la consola de Postgres (Railway → base → Query) DESPUÉS de aplicar el ALTER.
--
-- ⚠️ VIVE APARTE Y NO ES UN DESCUIDO: la lista blanca del aplicador RECHAZA un `SELECT` —es una
-- lista blanca de formas ADITIVAS y lo que no reconoce lo rechaza—, así que mezclarla con el
-- ALTER dejaría ese fichero inaplicable.
--
-- 🔴 COMPRUEBA EL TIPO, NO SÓLO LA EXISTENCIA. `schemaDrift.ts` sólo mira que la columna EXISTA;
-- una `internal_ref` creada como JSONB, VARCHAR(20) o INTEGER pasaría su chequeo y arrancaría en
-- verde. Aquí se lee `data_type` del catálogo.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- CÓMO SE LEE — y los DOS controles positivos, que son lo que hace que un cero signifique algo
--
--   control_name_text ......... 1 = la consulta VE el catálogo y sabe leer una columna de TEXTO.
--   control_optout_boolean .... 1 = y sabe leer una de OTRO TIPO (boolean).
--
--   🔴 LOS DOS CONTROLES SE LEEN AL REVÉS QUE EL RESTO. Un 0 en cualquiera de ellos NO significa
--      «falta esa columna» —`name` y `wa_opt_out` llevan ahí desde el principio— sino **que no se
--      ha comprobado nada**: la sesión mira a otro esquema (`search_path`), o no se pudo leer
--      `information_schema`. Con un control a 0, el veredicto de abajo NO VALE.
--
--      Y son DOS y de tipos DISTINTOS a propósito: con uno solo, y de texto, un catálogo que
--      devolviera «text» para todo daría los dos números buenos y no se notaría.
--
--   internal_ref_existe ....... 1 = la columna está.  0 = FALTA → aplica
--                               `docs/sql/scrum-588-customers-internal-ref.sql`.
--   internal_ref_es_text ...... 1 = y es del tipo correcto. **0 con `existe` a 1 es PEOR que
--                               falta**: la columna está, `schemaDrift` la da por buena, el
--                               arranque pasa en verde y el dato se corrompe al escribir.
--   internal_ref_nullable ..... 1 = acepta NULL, que es la decisión: «ausente ≠ vacío».
--   internal_ref_sin_default .. 1 = no tiene DEFAULT. Un default habría declarado «tiene
--                               referencia» a todos los clientes que ya existen.
--
-- VEREDICTO: controles a 1 y luego  1 · 1 · 1 · 1  →  esta base tiene lo que el código nombrará.
--            cualquier control a 0  →  no se ha comprobado nada; repetir.
-- ═════════════════════════════════════════════════════════════════════════════════════════

SELECT
  -- ── CONTROLES POSITIVOS · van primero: se leen antes que nada ──
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'customers'
       AND column_name = 'name' AND data_type = 'text')::int          AS control_name_text,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'customers'
       AND column_name = 'wa_opt_out' AND data_type = 'boolean')::int AS control_optout_boolean,

  -- ── LA COLUMNA DE ESTE TICKET ──
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'customers'
       AND column_name = 'internal_ref')::int                         AS internal_ref_existe,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'customers'
       AND column_name = 'internal_ref' AND data_type = 'text')::int   AS internal_ref_es_text,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'customers'
       AND column_name = 'internal_ref' AND is_nullable = 'YES')::int  AS internal_ref_nullable,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'customers'
       AND column_name = 'internal_ref' AND column_default IS NULL)::int AS internal_ref_sin_default;
