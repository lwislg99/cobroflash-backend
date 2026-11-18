-- SCRUM-1732 (opción A, PR-1) · tabla invoice_payments. Salida de
-- `node scripts/preview-migracion.mjs --desde <schema de origin/main>` (veredicto: aditiva).
-- Las cuatro `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY` del preview van DENTRO del CREATE TABLE,
-- con los mismos nombres y las mismas acciones, porque la lista blanca de `aplicar-sql-dev.mjs`
-- no admite ADD CONSTRAINT (precedente: SCRUM-1296, vf_submissions). El efecto es el mismo.
CREATE TABLE "invoice_payments" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "charge_id" INTEGER,
    "importe" DECIMAL(12,2) NOT NULL,
    "fecha_cobro" TIMESTAMP(3) NOT NULL,
    "fecha_origen" TEXT NOT NULL,
    "metodo" TEXT,
    "tipo" TEXT NOT NULL,
    "anula_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "invoice_payments_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoice_payments_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "invoice_payments_anula_id_fkey" FOREIGN KEY ("anula_id") REFERENCES "invoice_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "invoice_payments_anula_id_key" ON "invoice_payments"("anula_id");
CREATE INDEX "invoice_payments_merchant_id_fecha_cobro_idx" ON "invoice_payments"("merchant_id", "fecha_cobro");
CREATE UNIQUE INDEX "invoice_payments_invoice_id_charge_id_key" ON "invoice_payments"("invoice_id", "charge_id");
