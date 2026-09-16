-- docs/sql/scrum-579-direccion-facturacion.sql — SCRUM-579 (CONT-06)
--
-- LA DIRECCIÓN DE FACTURACIÓN DEL CLIENTE: cinco columnas en `customers`. UNA dirección, no dos.
--
-- ⚠️ ESTE FICHERO VA **ANTES** QUE EL CÓDIGO, Y HOY SABEMOS POR QUÉ. El orden es ① decisión →
-- ② `ALTER` en las TRES bases → ③ un solo PR con schema + código + tests. Producción llevó NUEVE
-- DÍAS sin desplegar porque tres veces se mergeó un esquema sin aplicar su `ALTER`: treinta
-- despliegues fallidos que nadie vio. Así que `prisma/schema.prisma` NO se ha tocado todavía:
-- este DDL se ejecuta primero y el schema entra después, en su PR.
--
-- ⚠️ MEDIDO CONTRA UN SHA, que es lo que permite saber si está completo:
--   · `origin/main` = a5aef1b9bbd2570eccbde82b407c9d3675192c2d · 2026-09-02T18:25:07+01:00
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- LOS TIPOS SALEN DE `prisma migrate diff`, NI UNO ADIVINADO
--
-- `schemaDrift` sólo mira que EXISTAN tabla y columna: NO mira tipos. Una columna creada con el
-- tipo equivocado arranca en VERDE y el defecto sale semanas después, delante de un cliente. Hoy
-- mismo hemos visto el caso: dos columnas que «por el nombre» parecían TEXT eran JSONB.
--
-- Estas cinco salen de comparar `prisma/schema.prisma` con la propuesta, sin tocar el fichero
-- del fundador:
--
--     prisma migrate diff --from-schema-datamodel prisma/schema.prisma \
--                         --to-schema-datamodel <propuesta.prisma> --script
--
-- Salida literal: cinco `ADD COLUMN … TEXT`. Veredicto comprobado sobre esa salida —
-- **DROP 0 · RENAME 0 · TRUNCATE 0 · DELETE 0 · SET NOT NULL 0**, con control positivo
-- (ADD COLUMN = 5, que son las cinco esperadas).
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 NULLABLE Y SIN `DEFAULT`, LOS CINCO — INCLUIDO EL PAÍS
--
-- «España por defecto» es del FORMULARIO (el selector nace en ES), NO de la columna. Un
-- `DEFAULT 'ES'` haría dos daños a la vez:
--   ① convertiría a los clientes que YA EXISTEN en «declarados en España» sin que nadie lo haya
--      dicho — el mismo motivo por el que `contactKind`, `tipoDestinatario` y
--      `recargoEquivalencia` son nullable y sin default, escrito en el esquema;
--   ② haría INDISTINGUIBLE «este cliente no tiene dirección» de «tiene la dirección en blanco»,
--      que es justo lo que el ticket exige poder distinguir.
--
-- Y `ADD COLUMN` nullable sin default no reescribe la tabla ni la bloquea: es seguro sobre las
-- filas que ya hay.
--
-- ═════════════════════════════════════════════════════════════════════════════════════════
-- LOS NOMBRES FÍSICOS, CONTRASTADOS CONTRA `docs/sql/deriva-prod.sql`
--
-- `customers` tiene hoy 16 columnas y TODAS en snake_case (`contact_kind`, `legal_name`,
-- `tax_id`, `tipo_destinatario`, `billing_periodicity`…). Estas cinco siguen esa convención.
--
-- EL PREFIJO `billing_` NO ES DECORACIÓN: es lo que impide confundir esto con la dirección de la
-- OBRA. El fundador cerró la P2 el 24-ago-2026 — la dirección de obra pertenece al DOCUMENTO y
-- no al cliente, porque un cliente puede tener tres obras. Eso es DOC-12 y no es este ticket.
--
-- MEDIDO el 2-sep-2026: en `yaqu_dev_javier` y en `railway`, `customers` tiene 16 columnas y la
-- única `billing_*` que existe es `billing_periodicity`. Ninguna de estas cinco está en ninguna
-- de las dos. RE-EJECUTABLE (`IF NOT EXISTS`): pasarlo dos veces no hace nada la segunda.
--
-- ⚠️ LA VERIFICACIÓN NO VIVE AQUÍ: `docs/sql/verificacion-scrum-579.sql`. La lista blanca del
-- aplicador (`scripts/_aplicar-sql-dev.mjs`) RECHAZA un `SELECT`, y un fichero que mezcle DDL y
-- comprobación queda INAPLICABLE.

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_address" TEXT;

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_city" TEXT;

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_postal_code" TEXT;

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_province" TEXT;

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "billing_country" TEXT;
