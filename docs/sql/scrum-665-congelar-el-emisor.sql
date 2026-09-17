-- SCRUM-665 · las siete columnas del EMISOR CONGELADO en `invoices`.
--
-- El fundador ya aplicó este mismo ALTER en STAGING y en PRODUCCIÓN. Esto lo lleva a la base de
-- DESARROLLO, que era la que faltaba. El texto es el del encargo, sin cambiar nada.
--
-- Aditivo e idempotente: `ADD COLUMN IF NOT EXISTS` no reescribe filas ni toca las que hay.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS merchant_name       TEXT,
  ADD COLUMN IF NOT EXISTS merchant_legal_name TEXT,
  ADD COLUMN IF NOT EXISTS merchant_tax_id     TEXT,
  ADD COLUMN IF NOT EXISTS merchant_address    TEXT,
  ADD COLUMN IF NOT EXISTS merchant_logo_url   TEXT,
  ADD COLUMN IF NOT EXISTS merchant_phone      TEXT,
  ADD COLUMN IF NOT EXISTS merchant_email      TEXT;
