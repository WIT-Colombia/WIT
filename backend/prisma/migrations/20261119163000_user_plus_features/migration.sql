-- User Plus data remains retained when membership expires or master switch is OFF.
CREATE TABLE `UserPlusSubscription` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'INACTIVE',
  `startsAt` DATETIME(3) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `revokedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserPlusSubscription_userId_key`(`userId`),
  INDEX `UserPlusSubscription_status_expiresAt_idx`(`status`, `expiresAt`),
  CONSTRAINT `UserPlusSubscription_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserPlusPreference` (
  `userId` CHAR(36) NOT NULL,
  `radarEnabled` BOOLEAN NOT NULL DEFAULT true,
  `priceAlertsEnabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`userId`),
  CONSTRAINT `UserPlusPreference_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserPlusCollection` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `title` VARCHAR(80) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `UserPlusCollection_userId_updatedAt_idx`(`userId`, `updatedAt`),
  CONSTRAINT `UserPlusCollection_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserPlusCollectionItem` (
  `id` CHAR(36) NOT NULL,
  `collectionId` CHAR(36) NOT NULL,
  `targetType` VARCHAR(16) NOT NULL,
  `targetId` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserPlusCollectionItem_collectionId_targetType_targetId_key`(`collectionId`, `targetType`, `targetId`),
  CONSTRAINT `UserPlusCollectionItem_collectionId_fkey` FOREIGN KEY (`collectionId`) REFERENCES `UserPlusCollection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserPlusSavedSearch` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `title` VARCHAR(80) NOT NULL,
  `query` VARCHAR(160) NOT NULL,
  `category` VARCHAR(120) NULL,
  `city` VARCHAR(120) NULL,
  `openNow` BOOLEAN NOT NULL DEFAULT false,
  `minRating` DOUBLE NULL,
  `sort` VARCHAR(16) NOT NULL DEFAULT 'recommended',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `UserPlusSavedSearch_userId_createdAt_idx`(`userId`, `createdAt`),
  CONSTRAINT `UserPlusSavedSearch_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `UserPlusPriceWatch` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `offerId` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `UserPlusPriceWatch_userId_offerId_key`(`userId`, `offerId`),
  INDEX `UserPlusPriceWatch_offerId_createdAt_idx`(`offerId`, `createdAt`),
  CONSTRAINT `UserPlusPriceWatch_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserPlusPriceWatch_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `BusinessOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OfferPriceHistory` (
  `id` CHAR(36) NOT NULL,
  `offerId` CHAR(36) NOT NULL,
  `previousPrice` DECIMAL(12,2) NULL,
  `newPrice` DECIMAL(12,2) NULL,
  `previousCurrency` CHAR(3) NULL,
  `currency` CHAR(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `OfferPriceHistory_offerId_createdAt_idx`(`offerId`, `createdAt`),
  CONSTRAINT `OfferPriceHistory_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `BusinessOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
