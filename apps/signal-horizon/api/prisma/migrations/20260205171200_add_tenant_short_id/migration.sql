-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "shortId" SERIAL;

-- CreateIndex
CREATE UNIQUE INDEX "tenants_shortId_key" ON "tenants"("shortId");
