-- docs/sql/scrum-576-customers-company-id.sql — SCRUM-576 (CONT-03)
--
-- LA EMPRESA A LA QUE PERTENECE UNA PERSONA. Una columna, un índice y una clave ajena.
--
-- ⛔ NO APLICADA EN NINGUNA BASE. Ni producción, ni staging, ni desarrollo. La aplica el
--    fundador. El checklist con las tres bases sin marcar vive en `docs/MIGRATIONS_PENDING.md`.
--
-- 🔴 EL PR QUE TRAE ESTE FICHERO **NO ES MERGEABLE HASTA QUE ESTA MIGRACIÓN ESTÉ APLICADA**, y no
--    es prudencia: `src/core/db/schemaDrift.ts` compara «esperado ⊆ real» en TABLAS y COLUMNAS y
--    **para el arranque** cuando el esquema nombra una columna que la base no tiene. Es lo que
--    dejó yaqu.app nueve días sirviendo el código del PR #862 en SCRUM-574. El orden correcto es
--    el que dejó escrito SCRUM-588: **la columna primero, la línea del schema después.**
--
-- ─────────────────────────────────────────────────────────────────────────────────────────
-- EL SQL NO SE ESCRIBIÓ A MANO
--
-- Lo generó `node scripts/preview-migracion.mjs --desde <schema anterior>` (CLI **local** de
-- Prisma; `npx` está prohibido, regla 3), con su control positivo en verde: **27 tablas**. Sin
-- ese control, un diff vacío se leería como «no hay cambios» — el incidente del 5-ago-2026.
--
-- Veredicto de la herramienta: **✔ aditiva** — ni DROP, ni RENAME, ni TRUNCATE, ni DELETE, ni
-- SET NOT NULL.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────
-- POR QUÉ `INTEGER` NULLABLE Y SIN `DEFAULT`
--
-- Sale de `companyId Int? @map("company_id")`. NULL = «esta persona no pertenece a ninguna
-- empresa, o nadie lo ha declarado», que es el caso de la inmensa mayoría de los clientes de un
-- fontanero. Un `DEFAULT` aquí no tendría ni siquiera un valor que poner: no existe «la empresa
-- por defecto».
--
-- Y es lo que hace la sentencia SEGURA sobre una tabla con filas: `ADD COLUMN` nullable no
-- reescribe la tabla ni la bloquea. Un `NOT NULL` sin default fallaría en seco — y la lista
-- blanca de `scripts/_clasificador-sql.mjs` lo rechaza por eso mismo.
--
-- ─────────────────────────────────────────────────────────────────────────────────────────
-- LA CLAVE AJENA ES EL TICKET, NO UN ADORNO
--
-- Lo que este ticket promete es que dos personas de la misma empresa apunten a **la misma
-- empresa**, no a dos cadenas parecidas. Sin la clave ajena, `company_id` sería un entero suelto
-- que puede señalar a una fila que ya no existe: texto libre con otro disfraz.
--
-- `ON DELETE SET NULL` y no `CASCADE`: borrar la empresa **no puede llevarse por delante a las
-- personas**. Pierden el vínculo y siguen existiendo, con sus presupuestos y sus facturas.
--
-- ⚠️ VALIDA TRIVIALMENTE HOY: la columna nace `NULL` en todas las filas, así que no hay ni un
-- valor huérfano que pueda hacerla fallar. Aplicada más tarde, sobre datos ya escritos, esa
-- garantía deja de ser gratis.
--
-- ⚠️ LA CLAVE AJENA **NO ES RE-EJECUTABLE**, y se dice porque las otras dos sí lo son. Postgres
-- no admite `ADD CONSTRAINT IF NOT EXISTS`; la única forma de darle esa propiedad es un bloque
-- `DO $$ … $$`, y la lista blanca del aplicador lo rechaza — con razón: dentro de un bloque
-- procedural cabe cualquier cosa, incluido un `DROP`. **Si se re-ejecuta este fichero, la tercera
-- sentencia dará `already exists`; las dos primeras no harán nada.** Es ruido, no daño.

ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "company_id" INTEGER;

CREATE INDEX IF NOT EXISTS "customers_company_id_idx" ON "customers"("company_id");

ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
