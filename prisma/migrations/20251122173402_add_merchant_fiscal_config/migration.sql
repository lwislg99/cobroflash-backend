-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "address" TEXT,
ADD COLUMN     "default_currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "invoice_series_prefix" TEXT NOT NULL DEFAULT 'CF',
ADD COLUMN     "legal_name" TEXT,
ADD COLUMN     "logo_url" TEXT,
ADD COLUMN     "next_invoice_number" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "tax_id" TEXT,
ADD COLUMN     "whatsapp_phone" TEXT;
