-- docs/sql/scrum-914-equipos-del-cliente.sql — SCRUM-914 (CRM, bloque 978) · paso ② de A5
--
-- EQUIPOS DEL CLIENTE: cada instalación o aparato del cliente (caldera, cuadro eléctrico, alarma…)
-- con marca, modelo, nº de serie, fecha de instalación y garantía, y un historial que sale de los
-- documentos que ya existen (trabajo, parte, albarán, mantenimiento).
--
-- ── APROBACIÓN ─────────────────────────────────────────────────────────────────────────────────
--   · ① Decisión del FUNDADOR, 17-sep-2026: «sí, sin duda» (descripción de SCRUM-914).
--   · Diseño aprobado por el ORQUESTADOR (cobroflash-backend-06), 27-sep-2026, opción «C»: el
--     equipo cuelga del CLIENTE (`customer_id` NOT NULL) y, OPCIONALMENTE, de uno de sus sitios
--     (`customer_site_id`, SCRUM-1014). Motivo: con sólo el cliente, el día que haya pantalla de
--     sitios haría falta un SEGUNDO ALTER; con sólo el sitio, 914 quedaría bloqueado por la
--     pantalla de sitios, que hoy no existe (0 referencias en `public/`).
--   · Escrito por la Sesión 1 (S1, `s1-27a`).
--
-- ── DÓNDE SE APLICA ────────────────────────────────────────────────────────────────────────────
--   En las TRES bases (dev, staging y producción), lo aplica el equipo de Javier, y ANTES de que
--   se mergee el PR ③ que toca `prisma/schema.prisma` (`schemaDrift` es fail-closed: un esquema
--   por delante de la base congela producción — SCRUM-1122).
--
-- ── ADITIVO PURO ───────────────────────────────────────────────────────────────────────────────
--   Una tabla NUEVA y cuatro columnas NULLABLES sin `DEFAULT` en tablas existentes, más índices.
--   No cambia, ni borra, ni reescribe ninguna fila: todo lo existente queda con `equipment_id` NULL
--   = «no está ligado a ningún equipo», que es la verdad de hoy. RE-EJECUTABLE (`IF NOT EXISTS`):
--   correrlo sobre una base ya aplicada no hace nada.
--
-- ── LAS CLAVES AJENAS, Y POR QUÉ SÓLO DOS ──────────────────────────────────────────────────────
--   · `merchant_id` y `customer_id` (NOT NULL) llevan FK con ON DELETE RESTRICT, igual que
--     `customer_sites` (docs/sql/scrum-1014-customer-site.sql).
--   · `customer_site_id` y los cuatro `equipment_id` (NULLABLES) van SIN clave ajena, a propósito:
--     es la decisión del fundador del 8-sep-2026 que el propio esquema recoge sobre
--     `Customer.companyId` (SCRUM-576) y `Quote.jobId` (SCRUM-195): «servicio de borrado, no
--     cascadas» (SCRUM-192). Una FK con ON DELETE SET NULL aquí serían DOS CRITERIOS para la
--     misma clase de relación.
--   → Lo que la FK habría hecho, lo hace el CÓDIGO del paso ③, en la misma transacción:
--       - borrar un equipo      → poner a NULL `equipment_id` en jobs, maintenance_plans,
--                                 albaranes y partes_trabajo de ese merchant;
--       - borrar un sitio       → poner a NULL `customer_site_id` en sus equipos;
--       - asignar un sitio      → comprobar que el sitio es del MISMO cliente Y del MISMO merchant
--                                 (regla 2: un sitio de otro comerciante es una fuga entre
--                                 inquilinos);
--       - ligar un documento    → comprobar que el equipo es del MISMO merchant (y del mismo
--                                 cliente que el documento).
--       - `borradoMerchant.ts` / `anonimizarMerchant.ts` → añadir `equipment` a sus listas.
--
-- ── CONTENIDO SELLADO ──────────────────────────────────────────────────────────────────────────
--   `albaranes.equipment_id` y `partes_trabajo.equipment_id` NO entran en el contenido canónico que
--   sella la firma (`evidenciaFirma`, `contenido_hash`): son columnas nuevas que el canónico no lee.
--   El paso ③ NO debe añadirlas al canónico.
--
-- ── DE DÓNDE SALE ──────────────────────────────────────────────────────────────────────────────
--   Derivado con `previewMigracion({ schema: <candidato>, desde: prisma/schema.prisma })` de
--   `scripts/preview-migracion.mjs` (control positivo dentro: ok, 32 tablas), OFFLINE, el
--   27-sep-2026, contra `prisma/schema.prisma` en origin/main
--   37bda5dbc6991cc33a54ee7248020be30d2f977f. El esquema candidato vivió en el scratchpad de la
--   sesión: `prisma/schema.prisma` del repo NO se ha tocado (regla 40). Los nombres de constraint e
--   índice son los que Prisma emitió. Nada aplicado a ninguna base, ni a staging.
--
-- El candidato de Prisma que el paso ③ tiene que escribir en `prisma/schema.prisma`:
--
--   model Equipment {
--     id             Int  @id @default(autoincrement())
--     merchantId     Int  @map("merchant_id")
--     customerId     Int  @map("customer_id")
--     customerSiteId Int? @map("customer_site_id")
--     type           String
--     name           String
--     brand          String?   @map("brand")
--     modelName      String?   @map("model_name")
--     serialNumber   String?   @map("serial_number")
--     installedOn    DateTime? @map("installed_on") @db.Date
--     warrantyUntil  DateTime? @map("warranty_until") @db.Date
--     createdAt      DateTime  @default(now()) @map("created_at")
--     updatedAt      DateTime  @updatedAt @map("updated_at")
--     merchant Merchant @relation(fields: [merchantId], references: [id])
--     customer Customer @relation(fields: [customerId], references: [id])
--     @@index([merchantId])
--     @@index([customerId])
--     @@index([customerSiteId])
--     @@map("equipments")
--   }
--   + `Equipment Equipment[]` en Merchant, `equipments Equipment[]` en Customer,
--   + `equipmentId Int? @map("equipment_id")` y `@@index([equipmentId])` en Job, MaintenancePlan,
--     Albaran y ParteTrabajo.
--
--   Fechas de instalación y garantía en `DATE`, no `TIMESTAMP`: son días del calendario, y un
--   instante leído en otra zona cambia de día (la familia de SCRUM-1093).

-- 1 · La tabla nueva.
CREATE TABLE IF NOT EXISTS "equipments" (
  "id"               SERIAL        NOT NULL,
  "merchant_id"      INTEGER       NOT NULL,
  "customer_id"      INTEGER       NOT NULL,
  "customer_site_id" INTEGER,
  "type"             TEXT          NOT NULL,
  "name"             TEXT          NOT NULL,
  "brand"            TEXT,
  "model_name"       TEXT,
  "serial_number"    TEXT,
  "installed_on"     DATE,
  "warranty_until"   DATE,
  "created_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3)  NOT NULL,
  CONSTRAINT "equipments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "equipments_merchant_id_fkey" FOREIGN KEY ("merchant_id")
    REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "equipments_customer_id_fkey" FOREIGN KEY ("customer_id")
    REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Las consultas calientes: «los equipos de este cliente» y «los de este sitio».
CREATE INDEX IF NOT EXISTS "equipments_merchant_id_idx"      ON "equipments"("merchant_id");
CREATE INDEX IF NOT EXISTS "equipments_customer_id_idx"      ON "equipments"("customer_id");
CREATE INDEX IF NOT EXISTS "equipments_customer_site_id_idx" ON "equipments"("customer_site_id");

-- 2 · El documento puede ir ligado a un equipo. NULL = no ligado (todo lo que ya existe).
ALTER TABLE "jobs"              ADD COLUMN IF NOT EXISTS "equipment_id" INTEGER;
ALTER TABLE "maintenance_plans" ADD COLUMN IF NOT EXISTS "equipment_id" INTEGER;
ALTER TABLE "albaranes"         ADD COLUMN IF NOT EXISTS "equipment_id" INTEGER;
ALTER TABLE "partes_trabajo"    ADD COLUMN IF NOT EXISTS "equipment_id" INTEGER;

-- El historial del equipo es «qué documentos apuntan a él»: sin índice, un recorrido por tabla.
CREATE INDEX IF NOT EXISTS "jobs_equipment_id_idx"              ON "jobs"("equipment_id");
CREATE INDEX IF NOT EXISTS "maintenance_plans_equipment_id_idx" ON "maintenance_plans"("equipment_id");
CREATE INDEX IF NOT EXISTS "albaranes_equipment_id_idx"         ON "albaranes"("equipment_id");
CREATE INDEX IF NOT EXISTS "partes_trabajo_equipment_id_idx"    ON "partes_trabajo"("equipment_id");

-- ── VERIFICACIÓN (solo lectura, después de aplicar) ────────────────────────────────────────────
-- Tiene que devolver 5 filas: equipments.customer_site_id + las cuatro equipment_id.
-- SELECT table_name, column_name, is_nullable, data_type
--   FROM information_schema.columns
--  WHERE (table_name = 'equipments' AND column_name = 'customer_site_id')
--     OR (column_name = 'equipment_id'
--         AND table_name IN ('jobs', 'maintenance_plans', 'albaranes', 'partes_trabajo'))
--  ORDER BY table_name;
