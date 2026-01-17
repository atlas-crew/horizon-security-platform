-- Add composite indexes for playbook queries (bead ac2)

-- Playbook: composite index for list queries filtered by tenant with active status
CREATE INDEX "playbooks_tenantId_isActive_updatedAt_idx" ON "playbooks"("tenantId", "isActive", "updatedAt" DESC);

-- PlaybookRun: composite index for list queries filtered by tenant with status
CREATE INDEX "playbook_runs_tenantId_status_startedAt_idx" ON "playbook_runs"("tenantId", "status", "startedAt" DESC);

-- PlaybookRun: composite index for concurrency checks (prevent duplicate runs)
CREATE INDEX "playbook_runs_playbookId_warRoomId_status_idx" ON "playbook_runs"("playbookId", "warRoomId", "status");
