-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "decisionChannel" TEXT,
ADD COLUMN     "decisionComment" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectionReason" TEXT;
