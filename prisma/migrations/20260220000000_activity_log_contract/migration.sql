-- Add canonical activity log fields
ALTER TABLE "activity_logs"
  ADD COLUMN "actorRole" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "eventCode" TEXT NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "entityType" TEXT,
  ADD COLUMN "entityId" TEXT,
  ADD COLUMN "targetUserId" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT;

ALTER TABLE "activity_logs"
  ADD CONSTRAINT "activity_logs_targetUserId_fkey"
  FOREIGN KEY ("targetUserId")
  REFERENCES "users"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
