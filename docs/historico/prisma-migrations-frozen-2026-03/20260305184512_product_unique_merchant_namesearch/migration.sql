/*
  Warnings:

  - A unique constraint covering the columns `[merchant_id,name_search]` on the table `products` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "products_merchant_id_name_search_key" ON "products"("merchant_id", "name_search");
