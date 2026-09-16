-- docs/sql/scrum-631-paso-1-crear-indice-parcial.sql — SCRUM-631 · OPCIÓN B, PASO 1 DE 2
--
-- ADITIVO. No borra nada: ni DROP, ni DELETE, ni TRUNCATE, ni ALTER ... TYPE. Ninguna fila y
-- ningún índice se pierden aquí. Por eso este paso SÍ lo acepta `scripts/aplicar-sql-dev.mjs`.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 POR QUÉ SON DOS FICHEROS Y NO UNO — me lo enseñó la herramienta de la casa
--
-- La primera versión de esto era un solo fichero con `BEGIN; CREATE...; DROP...; COMMIT;`.
-- `scripts/aplicar-sql-dev.mjs` lo RECHAZÓ, y tenía razón: su lista blanca sólo admite formas
-- aditivas, y «lo desconocido se rechaza, no se permite» (SCRUM-395: `--accept-data-loss` NO
-- protege a `db execute`). El rechazo no era un obstáculo: era el diseño diciendo que estos dos
-- pasos NO tienen el mismo riesgo y no deben viajar juntos.
--
-- ⚠️ Y EL ORDEN NO ES LIBRE. Primero se CREA el parcial y sólo después se retira el total. Entre
-- los dos pasos conviven ambos índices, y el total es el MÁS ESTRICTO: durante esa ventana el
-- callejón sigue (nadie puede reusar el nombre de un producto desactivado) pero NO SE ABRE NINGÚN
-- HUECO — dos activos con el mismo nombre siguen siendo imposibles. Al revés dejaría una ventana
-- sin garantía, que es justo la regla que este cambio no toca.
--
-- ⛔ EL PASO 2 (`scrum-631-paso-2-retirar-indice-total.sql`) NO SE APLICA HASTA QUE
--    `prisma/schema.prisma` haya dejado de declarar `@@unique([merchantId, nameSearch])`. Con el
--    `@@unique` todavía en el esquema, el siguiente `db push` RECREA el índice del callejón.
--    Medido — ver el máster.
-- ═════════════════════════════════════════════════════════════════════════════════════════


-- ⚠️ ANTES, en ESTA base: `docs/sql/scrum-631-verificar.sql`. Si `activos_duplicados` no es 0,
--    esta base NO se toca: habría filas que el índice nuevo no admite y el CREATE fallaría.

CREATE UNIQUE INDEX IF NOT EXISTS "products_merchant_nombre_activo_key"
  ON "products" ("merchant_id", "name_search")
  WHERE "is_active" = true;


-- DESPUÉS, en cada base: `docs/sql/scrum-631-verificar.sql`. Esperado: `indice_parcial` = 1.
