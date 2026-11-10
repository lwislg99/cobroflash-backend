-- SCRUM-1566 (c) + SCRUM-1490 + SCRUM-1445 + SCRUM-1518 · CONSULTA DE SÓLO LECTURA PARA PRODUCCIÓN — UNA autorización, CUATRO preguntas.
--
-- 🛑 ANTES DE PEGARLA, DOS COSAS:
--   1. `node docs/master/evidencias/SCRUM-1566/guard-solo-lectura.mjs <este fichero>` tiene que decir «✔ sólo lectura».
--   2. La primera sentencia de lo que pegas es `BEGIN TRANSACTION … READ ONLY` y la última `ROLLBACK`. Si no, NO se pega.
--
-- Devuelve sólo recuentos, ids de presupuesto, nombres de zona horaria y estados de mensaje: ni datos de clientes, ni teléfonos, ni importes.
--
-- ⛔ NO se ha corrido contra producción. La dispara quien tenga el acceso, cuando el fundador lo autorice.
--    Se puede pegar entera en una consola SQL (la de Railway, psql…): abre una transacción READ ONLY,
--    lee y la DESHACE. Postgres rechaza cualquier escritura dentro de ella (error 25006); además
--    `guard-solo-lectura.mjs` comprueba el fichero antes de usarlo.
-- ⚠️ Producción está congelada en un despliegue viejo: lo que se lea es el estado de ese momento.
--
-- ① SCRUM-1566 (c) · PRESUPUESTOS «C HEREDADOS»: descuento global con VARIOS tipos de IVA. Desde el
--    17-sep no se pueden crear, revisar ni facturar (SCRUM-887, c.15697): si existen, se quedan atascados.
--    El criterio es el de `tieneDescuentoGlobalConVariosIva` (invoiceLines.service.ts:68) →
--    `descuentoGlobalEnCentimos` (utils.ts): global > 0, sin cabeceras de apartado, más de un tipo
--    distinto y suma de bases > 0. Probado igual a la función real en el banco (probar-consulta.mjs).
--    Sólo devuelve RECUENTOS e IDs de presupuesto: ni nombres, ni importes, ni datos de clientes.
-- ② SCRUM-1490 · la consulta de la aceptación 6, TAL CUAL la probó S1 el 19-oct (publicada en su c.20041,
--    según el traspaso de S1; Jira no se ha podido releer hoy).
-- ③ SCRUM-1445 · cuántos negocios tienen zona horaria válida (sin ella, sus fechas salen en UTC).
--    Sólo recuentos y nombres de zona: ningún dato de negocio.
-- ④ SCRUM-1518 · qué estados hay guardados en los mensajes de WhatsApp (el indicador pinta «Enviado» ante uno que no conoce).
--    Sólo recuentos por estado y tipo: ni teléfonos ni textos.
--    No es la misma pregunta que ①: comparten la autorización, no el criterio.

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '60s';
SET LOCAL lock_timeout = '2s';

-- ① ─────────────────────────────────────────────────────────────────────────────────────────
WITH lineas AS (
  SELECT q.id, e.l
  FROM quotes q
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(q.lines) = 'array' THEN q.lines ELSE '[]'::jsonb END) AS e(l)
  WHERE q.discount_global_amount > 0
    -- `lineasQueSuman`: fuera las cabeceras de apartado (sólo el booleano true, apartados.ts:57).
    -- ⚠️ `IS DISTINCT FROM` y no `NOT (… = true)`: sin la clave, `->` da NULL y el NOT dejaba fuera
    -- TODAS las líneas normales — la consulta contaba 0 siempre. Lo cazó la siembra de probar-consulta.mjs.
    AND (e.l -> 'apartado') IS DISTINCT FROM 'true'::jsonb
),
-- `Number(x)` de JavaScript sobre un valor de JSON: número → él; texto numérico → él; texto vacío → 0;
-- booleano → 1/0; null → 0; ausente u otro → NULL (NaN).
valores AS (
  SELECT id,
    (SELECT CASE jsonb_typeof(v)
              WHEN 'number'  THEN (v #>> '{}')::numeric
              WHEN 'string'  THEN CASE
                WHEN btrim(v #>> '{}') = '' THEN 0
                WHEN btrim(v #>> '{}') ~ '^[-+]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][-+]?[0-9]+)?$' THEN btrim(v #>> '{}')::numeric
                ELSE NULL END
              WHEN 'boolean' THEN CASE WHEN v = 'true'::jsonb THEN 1 ELSE 0 END
              WHEN 'null'    THEN 0
              ELSE NULL END
       FROM (SELECT l -> 'tax') AS x(v)) AS tax,
    (SELECT CASE jsonb_typeof(v)
              WHEN 'number'  THEN (v #>> '{}')::numeric
              WHEN 'string'  THEN CASE
                WHEN btrim(v #>> '{}') = '' THEN 0
                WHEN btrim(v #>> '{}') ~ '^[-+]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][-+]?[0-9]+)?$' THEN btrim(v #>> '{}')::numeric
                ELSE NULL END
              WHEN 'boolean' THEN CASE WHEN v = 'true'::jsonb THEN 1 ELSE 0 END
              WHEN 'null'    THEN 0
              ELSE NULL END
       FROM (SELECT l -> 'qty') AS x(v)) AS qty,
    (SELECT CASE jsonb_typeof(v)
              WHEN 'number'  THEN (v #>> '{}')::numeric
              WHEN 'string'  THEN CASE
                WHEN btrim(v #>> '{}') = '' THEN 0
                WHEN btrim(v #>> '{}') ~ '^[-+]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][-+]?[0-9]+)?$' THEN btrim(v #>> '{}')::numeric
                ELSE NULL END
              WHEN 'boolean' THEN CASE WHEN v = 'true'::jsonb THEN 1 ELSE 0 END
              WHEN 'null'    THEN 0
              ELSE NULL END
       FROM (SELECT l -> 'price') AS x(v)) AS price,
    (SELECT CASE jsonb_typeof(v)
              WHEN 'number'  THEN (v #>> '{}')::numeric
              WHEN 'string'  THEN CASE
                WHEN btrim(v #>> '{}') = '' THEN 0
                WHEN btrim(v #>> '{}') ~ '^[-+]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][-+]?[0-9]+)?$' THEN btrim(v #>> '{}')::numeric
                ELSE NULL END
              WHEN 'boolean' THEN CASE WHEN v = 'true'::jsonb THEN 1 ELSE 0 END
              WHEN 'null'    THEN 0
              ELSE NULL END
       FROM (SELECT l -> 'dto') AS x(v)) AS dto
  FROM lineas
),
por_presupuesto AS (
  SELECT id,
    -- `tipoEnPorcentaje(Number(tax) || 0)`: la clave es el tipo en centésimas de punto
    count(DISTINCT round(coalesce(tax, 0) * 10000)) AS tipos,
    -- `Math.round(qty × precioConDto(price, dto) × 100)`, y un NaN cuenta 0
    sum(coalesce(round(qty * CASE
          WHEN price IS NULL THEN 0
          WHEN dto IS NOT NULL AND dto > 0 THEN price * (1 - least(100, dto) / 100)
          ELSE price END * 100), 0)) AS suma_bases_cents
  FROM valores
  GROUP BY id
),
c AS (
  SELECT q.id, q."merchantId", q.status, q."createdAt", q.archived_at,
         (q."acceptedAt" IS NOT NULL OR q.evidencia_firma IS NOT NULL OR q."signatureUrl" IS NOT NULL) AS firmado,
         EXISTS (SELECT 1 FROM invoices i WHERE i."quoteId" = q.id) AS con_factura
  FROM quotes q
  JOIN por_presupuesto p ON p.id = q.id
  WHERE p.tipos > 1 AND p.suma_bases_cents > 0
)
SELECT orden, medida, valor FROM (
  SELECT 1 AS orden, '① C heredados (global + varios IVA) · TOTAL'                AS medida, count(*)::text AS valor FROM c
  UNION ALL SELECT 2,  '   sin el negocio demo (id 1)',                            count(*)::text FROM c WHERE "merchantId" <> 1
  UNION ALL SELECT 3,  '   negocios distintos',                                    count(DISTINCT "merchantId")::text FROM c
  UNION ALL SELECT 4,  '   FIRMADOS o aceptados (acceptedAt / evidencia / firma)', count(*)::text FROM c WHERE firmado
  UNION ALL SELECT 5,  '   vivos: ni archivados, ni rechazados, ni caducados',     count(*)::text FROM c WHERE archived_at IS NULL AND status NOT IN ('rejected', 'expired')
  UNION ALL SELECT 6,  '   con alguna factura ya emitida (anterior al bloqueo)',   count(*)::text FROM c WHERE con_factura
  UNION ALL SELECT 7,  '   por estado',                                            coalesce(string_agg(status || ': ' || n, ' · ' ORDER BY status), '—')
                                                                                   FROM (SELECT status, count(*) AS n FROM c GROUP BY status) s
  UNION ALL SELECT 8,  '   creado entre',                                          coalesce(to_char(min("createdAt"), 'YYYY-MM-DD') || ' y ' || to_char(max("createdAt"), 'YYYY-MM-DD'), '—') FROM c
  UNION ALL SELECT 9,  '   ids (máx. 50)',                                         coalesce(string_agg(id::text, ', ' ORDER BY id), '—')
                                                                                   FROM (SELECT id FROM c ORDER BY id LIMIT 50) x
  UNION ALL SELECT 10, '   control: presupuestos leídos en total',                 count(*)::text FROM quotes
) r ORDER BY orden;

-- ② ─────────────────────────────────────────────────────────────────────────────────────────
-- SCRUM-1490 · aceptación 6 · SÓLO LECTURA: un único SELECT (no escribe, no crea nada, no bloquea).
WITH numeradas AS (
  SELECT q."merchantId", q.quote_number, q.revision, q.series_year,
         date_part('year', q."createdAt") AS anio_utc,
         date_part('year', (q."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid') AS anio_madrid
  FROM quotes q
  WHERE q.quote_number IS NOT NULL
),
originales AS (
  SELECT "merchantId", quote_number, count(*) AS cuantos, min(coalesce(series_year, anio_utc)) AS anio
  FROM numeradas
  WHERE revision = 0
  GROUP BY "merchantId", quote_number
)
SELECT
  (SELECT count(*) FROM quotes)                                                    AS filas_total,
  count(*) FILTER (WHERE n.series_year IS NULL)                                    AS sin_anio,
  count(*) FILTER (WHERE n.series_year IS NULL AND n.revision > 0
                     AND o.cuantos = 1 AND n.anio_utc <> o.anio)                   AS revision_en_otro_anio,
  count(*) FILTER (WHERE n.series_year IS NULL AND n.revision = 0
                     AND n.anio_utc <> n.anio_madrid)                              AS frontera_de_anio,
  count(*) FILTER (WHERE n.series_year IS NULL AND n.revision > 0
                     AND o.cuantos IS NULL)                                        AS revision_sin_original,
  count(*) FILTER (WHERE n.series_year IS NULL AND n.revision > 0
                     AND o.cuantos > 1)                                            AS revision_varios_originales,
  (SELECT count(*) FROM merchants WHERE coalesce(trim(timezone), '') <> '')        AS negocios_con_zona
FROM numeradas n
LEFT JOIN originales o ON o."merchantId" = n."merchantId" AND o.quote_number = n.quote_number;

-- ③ ─────────────────────────────────────────────────────────────────────────────────────────
-- ¿Cuántos negocios tienen zona horaria? (hallazgo de S4, SCRUM-1445). Sin zona, `zonaDelMerchant`
-- (src/core/zonaDelMerchant.ts) cae a 'UTC' y un documento hecho a las 00:30 en España sale con la
-- víspera: arreglar las fechas sólo le sirve a quien la tenga. «Válida» = la reconoce Postgres
-- (pg_timezone_names, sin distinguir mayúsculas); el código la valida con Intl: son la misma base IANA,
-- pero no el mismo programa — lo dice el probador, que las compara sobre las filas sembradas.
WITH m AS (
  SELECT id, nullif(btrim(timezone), '') AS zona FROM merchants
),
v AS (
  SELECT m.id, m.zona,
         (m.zona IS NOT NULL AND EXISTS (SELECT 1 FROM pg_timezone_names t WHERE lower(t.name) = lower(m.zona))) AS valida
  FROM m
)
SELECT orden, medida, valor FROM (
  SELECT 11 AS orden, '③ negocios · TOTAL'                                    AS medida, count(*)::text AS valor FROM v
  UNION ALL SELECT 12, '   con zona declarada (no vacía)',                    count(*)::text FROM v WHERE zona IS NOT NULL
  UNION ALL SELECT 13, '   con zona válida: sus fechas salen en su hora',     count(*)::text FROM v WHERE valida
  UNION ALL SELECT 14, '   sin zona o no válida: sus fechas salen en UTC',    count(*)::text FROM v WHERE NOT valida
  UNION ALL SELECT 15, '   zonas (máx. 10)',                                  coalesce(string_agg(zona || ': ' || n, ' · ' ORDER BY n DESC, zona), '—')
                                                                              FROM (SELECT zona, count(*) AS n FROM v WHERE zona IS NOT NULL GROUP BY zona ORDER BY n DESC, zona LIMIT 10) z
) r ORDER BY orden;

-- ④ ─────────────────────────────────────────────────────────────────────────────────────────
-- SCRUM-1518 (lo reprodujo S4) · ¿qué estados hay GUARDADOS en los mensajes de WhatsApp? El indicador
-- pinta «Enviado» ante cualquier estado que no conoce. Con el código de hoy el único alcanzable que no
-- conoce es `received`, pero las filas viejas las escribió código anterior. Sólo el recuento por estado y
-- tipo: ni teléfonos, ni textos, ni clientes.
SELECT orden, medida, valor FROM (
  SELECT 21 AS orden, '④ mensajes de WhatsApp · TOTAL' AS medida, count(*)::text AS valor FROM whatsapp_messages
  UNION ALL SELECT 22, '   estados distintos guardados', coalesce(string_agg(DISTINCT status, ' · ' ORDER BY status), '—') FROM whatsapp_messages
  UNION ALL SELECT 23, '   por estado y tipo', coalesce(string_agg(status || ' / ' || type || ': ' || n, ' · ' ORDER BY status, type), '—')
                                              FROM (SELECT status, type, count(*) AS n FROM whatsapp_messages GROUP BY status, type) g
) r ORDER BY orden;

ROLLBACK;
