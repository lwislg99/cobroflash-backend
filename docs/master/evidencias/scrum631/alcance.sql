-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- SCRUM-631 · ALCANCE DEL «NOMBRE OCUPADO PARA SIEMPRE»
--
-- SOLO LECTURA. No hay un solo INSERT, UPDATE, DELETE, ALTER ni CREATE en este fichero.
-- Se pega tal cual en la consola de Postgres de Railway. Son cuatro consultas independientes:
-- la (1) es la que responde al ticket; las otras tres son el detalle.
--
-- ⚠️ SOBRE LOS NOMBRES DE COLUMNA — COMPROBADO UNA A UNA, NO GENERALIZADO.
--
-- La tabla `products` es snake_case SIN EXCEPCIÓN. No lo deduzco de una regla: lo he leído en el
-- DDL real que la creó y en los dos ALTER posteriores
-- (docs/historico/prisma-migrations-frozen-2026-03/20251213111606_add_product_model/migration.sql
--  + 20251213124253_add_product_name_search + 20260309122015_add_product_provider_relation):
--
--     id · merchant_id · name · description · price · cost · vat · is_active
--     created_at · updated_at · name_search · provider_id
--
-- Por eso aquí NO hacen falta comillas dobles. Y la regla NO se puede exportar: medido sobre
-- `prisma/schema.prisma`, el modelo `Quote` tiene **15 campos camelCase SIN `@map`** —
-- `merchantId`, `customerId`, `createdAt`, `updatedAt`, `acceptedAt`, `rejectedAt`, `pdfUrl`,
-- `signatureUrl`, `chargeId`… — que en la base se llaman así, en camelCase, y SÍ exigen comillas
-- (`quotes."createdAt"`). En `products` los camelCase sin `@map` son **cero**.
-- ═══════════════════════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────────────────────
-- (1) EL PANORAMA. Ésta es la consulta del ticket.
--
-- `nombre_norm` imita `normalizeSearch()` (products.service.ts:7-14): recorta, baja a
-- minúsculas, colapsa espacios y quita tildes. ⚠️ La app usa NFD y quita CUALQUIER diacrítico;
-- aquí se usa `translate` con el juego español + ç, que no necesita la extensión `unaccent`.
-- Para un nombre con un diacrítico fuera de esa lista, esta consulta contaría de menos. Lo digo
-- para que el número se lea como lo que es.
-- ───────────────────────────────────────────────────────────────────────────────────────────
WITH norm AS (
  SELECT
    id, merchant_id, name, name_search, is_active,
    translate(
      lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))),
      'áéíóúüñçÁÉÍÓÚÜÑÇ',
      'aeiouuncAEIOUUNC'
    ) AS nombre_norm
  FROM products
),
grupos AS (
  SELECT merchant_id, nombre_norm, count(*) AS n,
         bool_or(is_active) AS hay_activo,
         bool_or(NOT is_active) AS hay_inactivo
  FROM norm GROUP BY merchant_id, nombre_norm
),
choques_unique AS (
  SELECT merchant_id, name_search FROM norm
  WHERE name_search IS NOT NULL
  GROUP BY merchant_id, name_search HAVING count(*) > 1
)
SELECT 1 AS orden,
       'productos TOTALES  <<< CONTROL POSITIVO: si esto sale 0, la consulta NO ha visto la tabla y ningun otro numero de abajo significa nada' AS medida,
       (SELECT count(*) FROM norm) AS valor
UNION ALL SELECT 2, 'activos',
       (SELECT count(*) FROM norm WHERE is_active)
UNION ALL SELECT 3, 'INACTIVOS  <<< cada uno ocupa su nombre, y hoy no hay forma de liberarlo',
       (SELECT count(*) FROM norm WHERE NOT is_active)
UNION ALL SELECT 4, 'con name_search NULL (anteriores a dic-2025: se escapan del UNIQUE porque en Postgres los NULL no chocan)',
       (SELECT count(*) FROM norm WHERE name_search IS NULL)
UNION ALL SELECT 5, 'merchants con al menos un producto',
       (SELECT count(DISTINCT merchant_id) FROM norm)
UNION ALL SELECT 6, 'merchants con al menos un INACTIVO  <<< son los que pueden toparse con el callejon',
       (SELECT count(DISTINCT merchant_id) FROM norm WHERE NOT is_active)
UNION ALL SELECT 7, 'CONTROL NEGATIVO: pares (merchant_id, name_search) repetidos con name_search NO nulo. DEBE SALIR 0. Si sale otra cosa, el indice unico no esta puesto o no es el que creemos, y toda la propuesta se apoya en algo falso',
       (SELECT count(*) FROM choques_unique)
UNION ALL SELECT 8, 'nombres NORMALIZADOS repetidos dentro de un mismo merchant (incluye los de name_search NULL)',
       (SELECT count(*) FROM grupos WHERE n > 1)
UNION ALL SELECT 9, '   de esos, los que YA mezclan un activo y un inactivo con el mismo nombre',
       (SELECT count(*) FROM grupos WHERE n > 1 AND hay_activo AND hay_inactivo)
ORDER BY orden;


-- ───────────────────────────────────────────────────────────────────────────────────────────
-- (2) EL DETALLE de los duplicados, si (8) o (9) no salen cero.
-- ───────────────────────────────────────────────────────────────────────────────────────────
WITH norm AS (
  SELECT merchant_id, name, name_search, is_active,
    translate(lower(btrim(regexp_replace(name, '\s+', ' ', 'g'))),
              'áéíóúüñçÁÉÍÓÚÜÑÇ', 'aeiouuncAEIOUUNC') AS nombre_norm
  FROM products
)
SELECT merchant_id, nombre_norm,
       count(*) AS filas,
       count(*) FILTER (WHERE is_active)     AS activos,
       count(*) FILTER (WHERE NOT is_active) AS inactivos,
       count(*) FILTER (WHERE name_search IS NULL) AS con_name_search_null,
       string_agg(DISTINCT name, ' | ')      AS nombres_tal_cual
FROM norm
GROUP BY merchant_id, nombre_norm
HAVING count(*) > 1
ORDER BY count(*) DESC, merchant_id
LIMIT 50;


-- ───────────────────────────────────────────────────────────────────────────────────────────
-- (3) REPARTO POR MERCHANT: quien acumula nombres bloqueados.
-- ───────────────────────────────────────────────────────────────────────────────────────────
SELECT merchant_id,
       count(*)                                   AS productos,
       count(*) FILTER (WHERE NOT is_active)      AS inactivos,
       count(*) FILTER (WHERE name_search IS NULL) AS name_search_null
FROM products
GROUP BY merchant_id
HAVING count(*) FILTER (WHERE NOT is_active) > 0
ORDER BY 3 DESC, merchant_id
LIMIT 30;


-- ───────────────────────────────────────────────────────────────────────────────────────────
-- (4) EL CALLEJON, EN SOLO LECTURA: los nombres que HOY estan bloqueados.
--
-- Dar de alta cualquiera de estos nombres —o cualquier variante suya de mayusculas, tildes o
-- espacios, que normalizan igual— devuelve hoy 409 `name_duplicate`, y no hay forma de liberarlo
-- desde el producto una vez que SCRUM-614 retire el borrado fisico.
-- ───────────────────────────────────────────────────────────────────────────────────────────
SELECT merchant_id, id, name, name_search, updated_at
FROM products
WHERE NOT is_active
ORDER BY merchant_id, updated_at DESC
LIMIT 50;
