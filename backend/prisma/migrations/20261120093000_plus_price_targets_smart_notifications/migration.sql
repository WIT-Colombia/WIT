-- Xamuko Plus: price objectives, opt-in notification cadence and idempotent daily summaries.
-- The migration retains existing subscriptions, preferences, watches and notification history.
ALTER TABLE `UserPlusPriceWatch`
  ADD COLUMN `targetAmount` DECIMAL(12,2) NULL,
  ADD COLUMN `targetCurrency` CHAR(3) NULL,
  ADD COLUMN `targetNotifiedAt` DATETIME(3) NULL;

ALTER TABLE `UserPlusPreference`
  ADD COLUMN `deliveryMode` VARCHAR(16) NOT NULL DEFAULT 'IMMEDIATE',
  ADD COLUMN `digestTimeZone` VARCHAR(64) NOT NULL DEFAULT 'America/Bogota',
  ADD COLUMN `digestHour` INT NOT NULL DEFAULT 8;

CREATE TABLE `UserPlusDigestEvent` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `kind` VARCHAR(16) NOT NULL,
  `adultOnly` BOOLEAN NOT NULL DEFAULT false,
  `sourceId` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `UserPlusDigestEvent_userId_createdAt_idx`(`userId`, `createdAt`),
  CONSTRAINT `UserPlusDigestEvent_userId_fkey` FOREIGN KEY (`userId`)
    REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserPlusDigestDispatch` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `localDay` CHAR(10) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserPlusDigestDispatch_userId_localDay_key`(`userId`, `localDay`),
  CONSTRAINT `UserPlusDigestDispatch_userId_fkey` FOREIGN KEY (`userId`)
    REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
