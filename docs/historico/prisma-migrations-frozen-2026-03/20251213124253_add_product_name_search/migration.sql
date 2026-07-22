-- AlterTable
ALTER TABLE "products" ADD COLUMN     "name_search" TEXT;

-- CreateIndex
CREATE INDEX "products_merchant_id_name_search_idx" ON "products"("merchant_id", "name_search");
