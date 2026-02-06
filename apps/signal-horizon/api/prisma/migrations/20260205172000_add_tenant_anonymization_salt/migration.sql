-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "anonymizationSalt" TEXT;

-- Backfill existing rows
UPDATE "tenants"
SET "anonymizationSalt" = md5(random()::text || clock_timestamp()::text)
WHERE "anonymizationSalt" IS NULL;

-- Enforce non-null after backfill
ALTER TABLE "tenants" ALTER COLUMN "anonymizationSalt" SET NOT NULL;
