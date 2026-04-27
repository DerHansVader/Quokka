-- Optional team icon (single emoji or short string).
ALTER TABLE "Team" ADD COLUMN IF NOT EXISTS "icon" TEXT;

-- Project visibility: 'team' (default; everyone in the team) or 'private' (allowlist).
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'team';

-- Explicit access rows for private projects.
CREATE TABLE IF NOT EXISTS "ProjectAccess" (
    "id"        UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId"    UUID NOT NULL,

    CONSTRAINT "ProjectAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectAccess_projectId_userId_key"
  ON "ProjectAccess"("projectId", "userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectAccess_projectId_fkey') THEN
    ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectAccess_userId_fkey') THEN
    ALTER TABLE "ProjectAccess" ADD CONSTRAINT "ProjectAccess_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Per-user pinned projects.
CREATE TABLE IF NOT EXISTS "ProjectPin" (
    "id"        UUID NOT NULL,
    "userId"    UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectPin_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectPin_userId_projectId_key"
  ON "ProjectPin"("userId", "projectId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectPin_userId_fkey') THEN
    ALTER TABLE "ProjectPin" ADD CONSTRAINT "ProjectPin_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProjectPin_projectId_fkey') THEN
    ALTER TABLE "ProjectPin" ADD CONSTRAINT "ProjectPin_projectId_fkey"
      FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
