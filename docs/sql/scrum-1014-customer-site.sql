-- docs/sql/scrum-1014-customer-site.sql — SCRUM-1014 (CRM)
--
-- «SITIOS» DEL CLIENTE: agenda de direcciones de obra, cada una con su contacto propio.
--
-- ADITIVO PURO: tabla nueva, no toca `customers` ni ninguna otra. Vacía, no cambia nada de lo
-- que hoy funciona. RE-EJECUTABLE (`IF NOT EXISTS`): correrlo sobre una base ya aplicada no hace
-- nada.
--
-- 🔴 NO PRECARGA NADA (com. 16921 de Jira): esta tabla es sólo dónde vive la agenda de
-- direcciones. El presupuesto/trabajo sigue con `shippingAddress`/`shippingAddressMode`
-- (SCRUM-602, P2/DOC-12) intactos — el profesional elige un sitio a mano, nada lo copia solo.
--
-- Generado con `node scripts/preview-migracion.mjs --desde <schema sin este modelo>` (control
-- positivo dentro; SCRUM-385) el 25-sep-2026, contra `prisma/schema.prisma` en origin/main
-- 639a276ffbd6e4ce8ef89b7f8e81c72fad31c111. Los nombres de constraint EXPLÍCITOS son los que
-- Prisma emitió, no una convención aparte.

CREATE TABLE IF NOT EXISTS "customer_sites" (
  "id"           SERIAL        NOT NULL,
  "merchant_id"  INTEGER       NOT NULL,
  "customer_id"  INTEGER       NOT NULL,
  "name"         TEXT          NOT NULL,
  "address"      TEXT,
  "city"         TEXT,
  "postal_code"  TEXT,
  "province"     TEXT,
  "country"      TEXT,
  "contact_name" TEXT,
  "phone"        TEXT,
  "created_at"   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "customer_sites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_sites_merchant_id_fkey" FOREIGN KEY ("merchant_id")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "customer_sites_customer_id_fkey" FOREIGN KEY ("customer_id")
    REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- La consulta caliente es «los sitios de este cliente»; sin índice sería un recorrido entero.
CREATE INDEX IF NOT EXISTS "customer_sites_merchant_id_idx" ON "customer_sites"("merchant_id");
CREATE INDEX IF NOT EXISTS "customer_sites_customer_id_idx" ON "customer_sites"("customer_id");
