CREATE TABLE `BusinessPromotion` (
  `id` CHAR(36) NOT NULL,
  `businessId` CHAR(36) NOT NULL,
  `relatedOfferId` CHAR(36) NULL,
  `idempotencyKey` CHAR(36) NULL,
  `type` ENUM('OFFER','PROMOTION') NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `description` VARCHAR(500) NOT NULL,
  `conditions` VARCHAR(500) NULL,
  `category` VARCHAR(100) NULL,
  `originalPrice` DECIMAL(12,2) NULL,
  `promotionalPrice` DECIMAL(12,2) NULL,
  `startsAt` DATETIME(3) NOT NULL,
  `endsAt` DATETIME(3) NOT NULL,
  `recurrence` ENUM('NONE','DAILY','WEEKLY','MONTHLY') NOT NULL DEFAULT 'NONE',
  `recurrenceUntil` DATETIME(3) NULL,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `deletedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `BusinessPromotion_idempotencyKey_key` (`idempotencyKey`),
  KEY `BusinessPromotion_businessId_active_startsAt_endsAt_idx` (`businessId`,`active`,`startsAt`,`endsAt`),
  KEY `BusinessPromotion_businessId_deletedAt_updatedAt_idx` (`businessId`,`deletedAt`,`updatedAt`),
  KEY `BusinessPromotion_relatedOfferId_idx` (`relatedOfferId`),
  CONSTRAINT `BusinessPromotion_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessPromotion_relatedOfferId_fkey` FOREIGN KEY (`relatedOfferId`) REFERENCES `BusinessOffer` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BusinessPromotionPhoto` (
  `id` CHAR(36) NOT NULL,
  `businessId` CHAR(36) NOT NULL,
  `promotionId` CHAR(36) NOT NULL,
  `storageKey` VARCHAR(1024) NOT NULL,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `uploadedById` CHAR(36) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `BusinessPromotionPhoto_businessId_promotionId_sortOrder_idx` (`businessId`,`promotionId`,`sortOrder`),
  KEY `BusinessPromotionPhoto_uploadedById_idx` (`uploadedById`),
  CONSTRAINT `BusinessPromotionPhoto_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessPromotionPhoto_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `BusinessPromotion` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessPromotionPhoto_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BusinessPromotionView` (
  `id` CHAR(36) NOT NULL,
  `businessId` CHAR(36) NOT NULL,
  `promotionId` CHAR(36) NOT NULL,
  `dedupeKey` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `BusinessPromotionView_dedupeKey_key` (`dedupeKey`),
  KEY `BusinessPromotionView_businessId_createdAt_idx` (`businessId`,`createdAt`),
  KEY `BusinessPromotionView_promotionId_createdAt_idx` (`promotionId`,`createdAt`),
  CONSTRAINT `BusinessPromotionView_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessPromotionView_promotionId_fkey` FOREIGN KEY (`promotionId`) REFERENCES `BusinessPromotion` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
