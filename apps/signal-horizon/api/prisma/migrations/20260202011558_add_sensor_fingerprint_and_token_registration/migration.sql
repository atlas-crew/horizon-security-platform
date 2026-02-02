-- AlterEnum
ALTER TYPE "RegistrationMethod" ADD VALUE 'TOKEN';

-- AlterTable
ALTER TABLE "sensor_pingora_configs" ADD COLUMN     "fullConfig" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "sensors" ADD COLUMN     "fingerprint" TEXT;
