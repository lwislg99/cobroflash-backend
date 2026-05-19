-- AlterTable
ALTER TABLE "products" ADD COLUMN     "provider_id" INTEGER;

-- CreateIndex
CREATE INDEX "products_provider_id_idx" ON "products"("provider_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
