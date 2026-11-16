-- Separate an administrative publication restriction from a voluntary owner pause.
-- Existing businesses remain unrestricted. Preserve previous visibility for safe restoration.
ALTER TABLE `Business`
  ADD COLUMN `administrativeRestriction` VARCHAR(16) NULL,
  ADD COLUMN `administrativePreviousVisibility` ENUM('VISIBLE','HIDDEN','EXPIRED','REVIEW') NULL,
  ADD COLUMN `administrativeRestrictedAt` DATETIME(3) NULL,
  ADD COLUMN `administrativeRestrictionReason` VARCHAR(500) NULL;

CREATE INDEX `Business_administrativeRestriction_idx`
  ON `Business`(`administrativeRestriction`);
