-- CreateTable
CREATE TABLE "tunnel_sessions" (
    "id" TEXT NOT NULL,
    "sensorId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "tunnel_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tunnel_sessions_tenantId_idx" ON "tunnel_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "tunnel_sessions_sensorId_idx" ON "tunnel_sessions"("sensorId");

-- AddForeignKey
ALTER TABLE "tunnel_sessions" ADD CONSTRAINT "tunnel_sessions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tunnel_sessions" ADD CONSTRAINT "tunnel_sessions_sensorId_fkey" FOREIGN KEY ("sensorId") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
