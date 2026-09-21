-- SCRUM-797 · quién crea clientes.
-- 🔴 NO ADITIVO: quita el DEFAULT 1 de `customers.merchant_id`. Un cliente insertado sin
-- merchant caía en el merchant 1 (el demo) en silencio; sin defecto, la inserción falla y se ve.
ALTER TABLE "customers" ALTER COLUMN "merchant_id" DROP DEFAULT;
