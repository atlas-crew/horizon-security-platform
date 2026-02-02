-- CreateTable
CREATE TABLE "sensor_pingora_configs" (
    "id" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "wafEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wafThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "wafOverrides" JSONB,
    "rateLimitEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rps" INTEGER NOT NULL DEFAULT 100,
    "burst" INTEGER NOT NULL DEFAULT 50,
    "allowList" TEXT[],
    "denyList" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sensor_pingora_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sensor_pingora_configs_sensorId_key" ON "sensor_pingora_configs"("sensorId");

-- AddForeignKey
ALTER TABLE "sensor_pingora_configs" ADD CONSTRAINT "sensor_pingora_configs_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
