/*
  Warnings:

  - The primary key for the `charges` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `charges` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `customer_id` column on the `charges` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `customers` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `customers` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `events` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `events` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `merchants` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `merchants` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `reconciliations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `reconciliations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `merchant_id` on the `charges` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `charge_id` on the `events` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `charge_id` on the `reconciliations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."charges" DROP CONSTRAINT "charges_customer_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."charges" DROP CONSTRAINT "charges_merchant_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."events" DROP CONSTRAINT "events_charge_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."reconciliations" DROP CONSTRAINT "reconciliations_charge_id_fkey";

-- AlterTable
ALTER TABLE "public"."charges" DROP CONSTRAINT "charges_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "merchant_id",
ADD COLUMN     "merchant_id" INTEGER NOT NULL,
DROP COLUMN "customer_id",
ADD COLUMN     "customer_id" INTEGER,
ADD CONSTRAINT "charges_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."customers" DROP CONSTRAINT "customers_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."events" DROP CONSTRAINT "events_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "charge_id",
ADD COLUMN     "charge_id" INTEGER NOT NULL,
ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."merchants" DROP CONSTRAINT "merchants_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "merchants_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."reconciliations" DROP CONSTRAINT "reconciliations_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
DROP COLUMN "charge_id",
ADD COLUMN     "charge_id" INTEGER NOT NULL,
ADD CONSTRAINT "reconciliations_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "charges_merchant_id_status_idx" ON "public"."charges"("merchant_id", "status");

-- CreateIndex
CREATE INDEX "charges_customer_id_idx" ON "public"."charges"("customer_id");

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
