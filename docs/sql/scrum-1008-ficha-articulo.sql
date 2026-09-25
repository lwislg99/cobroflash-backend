-- SCRUM-1008 · La ficha del artículo: SKU, referencia del proveedor y unidad.
--
-- Aditiva, generada offline con `node scripts/preview-migracion.mjs` (0 DROP, 0 RENAME, 0
-- TRUNCATE, 0 DELETE, 0 SET NOT NULL). PENDIENTE DE APLICAR en producción: el job informativo
-- "constancia del ALTER" del PR #1750 mide contra la base VIVA y confirma que las tres columnas
-- faltan hoy. Sin este ALTER, `schemaDrift` se niega a arrancar en producción (fail-closed,
-- correcto) y el despliegue del PR se queda sin efecto en silencio — no cae, «no cambia nada».
--
-- Ejecuta el fundador (o quien tenga la clave de producción) en la consola de Postgres de Railway
-- ANTES de que el merge llegue a desplegarse, o inmediatamente después si ya mergeó.

ALTER TABLE "products" ADD COLUMN     "sku" TEXT,
ADD COLUMN     "supplier_ref" TEXT,
ADD COLUMN     "unit" TEXT;
