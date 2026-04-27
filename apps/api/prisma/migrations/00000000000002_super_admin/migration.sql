-- Add instance-level super admin flag.
-- A Quokka instance is one company; the super admin can see and manage
-- every team and user, and does not need to be a member of any team.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: if no super admin exists yet, promote the oldest user.
-- This makes existing single-company deployments work without manual SQL.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE "isSuperAdmin" = true) THEN
    UPDATE "User"
       SET "isSuperAdmin" = true
     WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1);
  END IF;
END $$;

-- Rename team-membership role 'admin' -> 'team_admin' to free the word
-- "admin" for the new instance-level super admin.
UPDATE "TeamMember" SET "role" = 'team_admin' WHERE "role" = 'admin';
UPDATE "Invite"     SET "role" = 'team_admin' WHERE "role" = 'admin';
