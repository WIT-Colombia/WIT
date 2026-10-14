-- Add an optional branch label without changing existing business data.
ALTER TABLE `Business` ADD COLUMN `sede` VARCHAR(160) NULL;
