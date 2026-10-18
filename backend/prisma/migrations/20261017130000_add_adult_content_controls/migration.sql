-- Additive +18 controls. Existing users and offers remain restricted by default.
ALTER TABLE `User`
  ADD COLUMN `adultContentEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `adultContentAcceptedAt` DATETIME(3) NULL,
  ADD COLUMN `adultContentAcceptedVersion` VARCHAR(32) NULL,
  ADD COLUMN `adultContentRevokedAt` DATETIME(3) NULL;

ALTER TABLE `BusinessOffer`
  ADD COLUMN `adultOnly` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `BusinessOffer_businessId_kind_adultOnly_active_idx`
  ON `BusinessOffer`(`businessId`, `kind`, `adultOnly`, `active`);
