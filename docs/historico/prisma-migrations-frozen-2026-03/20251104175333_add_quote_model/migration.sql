-- CreateTable
CREATE TABLE "public"."quotes" (
    "id" SERIAL NOT NULL,
    "merchantId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "lines" JSONB NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "evidence" JSONB,
    "chargeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "public"."merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotes" ADD CONSTRAINT "quotes_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "public"."charges"("id") ON DELETE SET NULL ON UPDATE CASCADE;
