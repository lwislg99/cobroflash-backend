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
-- CÓMO SE LEE — el NÚMERO DE FILAS es el veredicto
--
--   2 filas ... `name` y `wa_opt_out`, los dos CONTROLES POSITIVOS. Estaban ahí desde siempre:
--               si aparecen, la consulta VE el catálogo y sabe leer DOS TIPOS distintos.
--   3 filas ... y además `internal_ref`. Mira su columna `tipo`: tiene que poner **text**.
--
--   🔴 0 ó 1 FILAS SE LEE AL REVÉS QUE EL RESTO. No significa «falta internal_ref»: significa
--      que NO SE HA COMPROBADO NADA — la sesión mira a otro esquema (`search_path`) o no se pudo
--      leer `information_schema`. Con menos de 2 filas el veredicto no vale.
--
--   🔴 Y `internal_ref` presente con un `tipo` que NO sea `text` es PEOR que ausente:
--      `schemaDrift` sólo comprueba que la columna EXISTA, así que el arranque pasaría en verde y
--      el dato se corrompería al escribir. En la deriva anterior dos columnas eran JSONB.
--
--   `acepta_null` = YES y `por_defecto` = (sin default) son la decisión «ausente ≠ vacío»: lo
--   vacío viaja como NULL, y un DEFAULT habría declarado «tiene referencia» a todos los clientes
--   que ya existen sin que nadie lo dijera.

-- ── UNA FILA POR COLUMNA ENCONTRADA, y por eso el número de filas ES el veredicto ───────
-- ANTES del ALTER  → 2 filas (los dos controles).
-- DESPUÉS          → 3 filas, y la tercera es `internal_ref` con su tipo.
--
-- 🛑 Y SI EL «ANTES» DE LA SEGUNDA BASE YA TRAE 3 FILAS, PARA. No significa que alguien se
-- adelantara: significa que las dos claves apuntan a la MISMA base y se está aplicando dos veces
-- sobre ella. Esta casa ya tuvo `DATABASE_URL_STAGING` mirando a desarrollo, y STAGING y TESTS
-- siendo la misma cadena (SCRUM-668). Aplicar dos veces sobre la misma base se ve EXACTAMENTE
-- IGUAL que hacerlo bien — salvo por este recuento.

SELECT
  column_name                                        AS columna,
  data_type                                          AS tipo,
  is_nullable                                        AS acepta_null,
  COALESCE(column_default, '(sin default)')          AS por_defecto,
  CASE column_name
    WHEN 'name'         THEN 'CONTROL POSITIVO (text)'
    WHEN 'wa_opt_out'   THEN 'CONTROL POSITIVO (boolean) — otro tipo, a proposito'
    WHEN 'internal_ref' THEN 'LA COLUMNA DE ESTE TICKET'
  END                                                AS papel
FROM information_schema.columns
WHERE table_schema = current_schema()
  AND table_name = 'customers'
  AND column_name IN ('name', 'wa_opt_out', 'internal_ref')
ORDER BY papel, column_name;
