-- CreateTable
CREATE TABLE "public"."merchants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "psp_id" TEXT,
    "iban" TEXT,
    "clabe" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."charges" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "concepto" TEXT NOT NULL,
    "importe" DECIMAL(12,2) NOT NULL,
    "moneda" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "vencimiento" TIMESTAMP(3),
    "referencia" TEXT,
    "intent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."events" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reconciliations" (
    "id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "bank_ref" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchants_country_idx" ON "public"."merchants"("country");

-- CreateIndex
CREATE INDEX "charges_merchant_id_status_idx" ON "public"."charges"("merchant_id", "status");

-- CreateIndex
CREATE INDEX "charges_customer_id_idx" ON "public"."charges"("customer_id");

-- CreateIndex
CREATE INDEX "charges_status_vencimiento_idx" ON "public"."charges"("status", "vencimiento");

-- CreateIndex
CREATE INDEX "events_charge_id_type_idx" ON "public"."events"("charge_id", "type");

-- CreateIndex
CREATE INDEX "reconciliations_charge_id_matched_idx" ON "public"."reconciliations"("charge_id", "matched");

-- AddForeignKey
ALTER TABLE "public"."charges" ADD CONSTRAINT "charges_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."charges" ADD CONSTRAINT "charges_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."events" ADD CONSTRAINT "events_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reconciliations" ADD CONSTRAINT "reconciliations_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "public"."charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
