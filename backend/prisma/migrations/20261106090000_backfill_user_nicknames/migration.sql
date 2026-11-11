-- Backfill accounts created before automatic nickname generation.
-- Existing non-null nicknames are never changed.
UPDATE `User`
SET `nickname` = CONCAT('@u', SUBSTRING(REPLACE(`id`, '-', ''), 1, 30))
WHERE `nickname` IS NULL;

-- The UNIQUE index already exists from the collaborator migration. The application
-- retries nickname collisions, so this migration remains additive and non-destructive.
