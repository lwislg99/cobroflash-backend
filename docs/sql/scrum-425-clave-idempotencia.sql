-- SCRUM-425 · La columna de la clave de idempotencia del albarán (H3 / SCRUM-358).
--
-- ⚠️ NOMBRES DE LA BASE (snake_case), NO DEL MODELO. Salen de los @@map/@map del schema, y el
-- del índice es el que Prisma DERIVA de los nombres de base — mismo patrón que
-- `charges_receipt_token_key` y `albaranes_merchant_id_invoice_id_idx`. No se "corrigen":
-- así se aplicó a producción y a staging el 10-ago-2026.
--
-- ADITIVO Y RE-EJECUTABLE: las dos sentencias llevan IF NOT EXISTS, así que volver a correrlo
-- sobre una base ya aplicada no hace nada y no falla.
--
-- 🔴 EL ÍNDICE NO ES UN ACCESORIO. El mecanismo de idempotencia de H3 (opción 1, forma F3 de
-- `invoiceNumber.service.ts:115-122`) pregunta al CONSTRAINT dentro del cerrojo de serie. Sin el
-- único, esa pregunta no tiene a quién hacerse: la columna sola no impide el duplicado.

ALTER TABLE "albaranes"
  ADD COLUMN IF NOT EXISTS "clave_idempotencia" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "albaranes_merchant_id_clave_idempotencia_key"
  ON "albaranes"("merchant_id", "clave_idempotencia");
