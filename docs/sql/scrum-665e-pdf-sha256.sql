-- SCRUM-665e · huella del PDF congelado (GO SCRUM-665 c.21182 punto 4). DDL de docs/MIGRATIONS_PENDING.md.
ALTER TABLE "invoices" ADD COLUMN "pdf_sha256" TEXT;
