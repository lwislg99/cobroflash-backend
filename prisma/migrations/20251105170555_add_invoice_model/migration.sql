-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "merchantId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "quoteId" INTEGER,
    "number" TEXT NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "qrData" TEXT NOT NULL,
    "registerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
