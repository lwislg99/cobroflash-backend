-- SCRUM-1569e · lo que a la base DEV (`yaqu_dev_javier`) le FALTA respecto a `prisma/schema.prisma` de origin/main
-- (c47288f7e82fb9dea4473f71e161a3836ac788f3). SOLO la parte (a) del preview: CREATE / ADD.
--
-- Copiado literal de `salida-preview-dev-contra-main.txt` (preview de la casa, control positivo 33 tablas).
-- La parte (b) —lo que dev tiene y main no— NO va aquí: son ALTER del paso ② de A5 aplicados antes de su PR ③,
-- y un DROP los perdería (registro, tramo 1569e).
--
-- Para el COLABORADOR (Javier), según A5. Destino: SOLO dev. Esta sesión no ha aplicado nada.
-- ⚠️ El `.sql` de SCRUM-597 NO sirve para esto: usa `CREATE TABLE IF NOT EXISTS` con los FK dentro, y en dev las
--    dos tablas ya existen SIN sus FK, así que no haría nada. Por eso los cuatro FK van sueltos aquí.
-- Sonda (solo SELECT, `salida-sonda-assignees.txt`): las dos tablas tienen 0 filas y 0 huérfanos; los FK caben.

-- ── SCRUM-1008 · products: sku, supplier_ref, unit (= docs/sql/scrum-1008-ficha-articulo.sql)
ALTER TABLE "products" ADD COLUMN     "sku" TEXT,
ADD COLUMN     "supplier_ref" TEXT,
ADD COLUMN     "unit" TEXT;

-- ── SCRUM-1014 · customer_sites (mismo contenido que docs/sql/scrum-1014-customer-site.sql)
CREATE TABLE "customer_sites" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "postal_code" TEXT,
    "province" TEXT,
    "country" TEXT,
    "contact_name" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_sites_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_sites_merchant_id_idx" ON "customer_sites"("merchant_id");

CREATE INDEX "customer_sites_customer_id_idx" ON "customer_sites"("customer_id");

ALTER TABLE "customer_sites" ADD CONSTRAINT "customer_sites_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_sites" ADD CONSTRAINT "customer_sites_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── SCRUM-597 · los cuatro FK que faltan en quote_assignees / invoice_assignees
ALTER TABLE "quote_assignees" ADD CONSTRAINT "quote_assignees_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quote_assignees" ADD CONSTRAINT "quote_assignees_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_assignees" ADD CONSTRAINT "invoice_assignees_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_assignees" ADD CONSTRAINT "invoice_assignees_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
