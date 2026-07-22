-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "charge_id" INTEGER,
ADD COLUMN     "client_comment" TEXT,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
