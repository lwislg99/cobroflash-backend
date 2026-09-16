-- docs/sql/scrum-631-paso-2-retirar-indice-total.sql — SCRUM-631 · OPCIÓN B, PASO 2 DE 2
--
-- 🔴 DESTRUCTIVO: retira un índice. `scripts/aplicar-sql-dev.mjs` NO lo aplica y no debe hacerlo
--    — su lista blanca es aditiva a propósito. Este paso lo ejecuta UNA PERSONA que ha leído el
--    host, en cada base, y en producción lo hace el fundador.
--
-- NO BORRA DATOS: no hay DELETE, ni TRUNCATE, ni DROP COLUMN, ni DROP TABLE. Ninguna fila se
-- pierde. Lo que se retira es la restricción vieja, ya sustituida por la del paso 1.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- ⛔ LAS DOS CONDICIONES, Y NINGUNA ES OPCIONAL
--
-- ① EL PASO 1 TIENE QUE ESTAR APLICADO EN ESTA MISMA BASE. Comprobarlo con
--    `scrum-631-verificar.sql`: `indice_parcial` = 1. Si sale 0 y se corre esto igual, la tabla
--    se queda SIN NINGUNA unicidad de nombre y dos productos activos podrían llamarse igual —
--    que es la regla que este ticket NO cambia.
--
-- ② `prisma/schema.prisma` YA NO DECLARA `@@unique([merchantId, nameSearch])`. Mientras lo
--    declare, el siguiente `db push` RECREA este índice y el callejón vuelve, en silencio.
--    El esquema es del fundador: el diff está preparado en el máster y lo aplica él.
--
-- Orden completo: paso 1 (aditivo, las tres bases) → PR del esquema mergeado → paso 2 (las tres
-- bases). Nunca el 2 antes que el cambio de esquema.
-- ═════════════════════════════════════════════════════════════════════════════════════════

DROP INDEX IF EXISTS "products_merchant_id_name_search_key";


-- DESPUÉS: `docs/sql/scrum-631-verificar.sql`.
-- Esperado: `indice_parcial` = 1 · `indice_total_unico` = 0 · `control_ve_los_indices` >= 2.
