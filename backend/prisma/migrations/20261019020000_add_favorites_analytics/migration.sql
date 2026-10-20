-- Add persistent business favorites and analytics history.
CREATE TABLE `BusinessFavorite` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `businessId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BusinessFavorite_userId_businessId_key`(`userId`, `businessId`),
    INDEX `BusinessFavorite_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `BusinessFavorite_businessId_createdAt_idx`(`businessId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BusinessAnalyticsEvent` (
    `id` CHAR(36) NOT NULL,
    `businessId` CHAR(36) NOT NULL,
    `eventType` ENUM('BUSINESS_VIEW', 'SEARCH_IMPRESSION', 'WHATSAPP_CLICK', 'PHONE_CLICK') NOT NULL,
    `actorUserId` CHAR(36) NULL,
    `dedupeKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BusinessAnalyticsEvent_dedupeKey_key`(`dedupeKey`),
    INDEX `BusinessAnalyticsEvent_businessId_eventType_createdAt_idx`(`businessId`, `eventType`, `createdAt`),
    INDEX `BusinessAnalyticsEvent_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BusinessFavorite`
  ADD CONSTRAINT `BusinessFavorite_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `BusinessFavorite_businessId_fkey`
    FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `BusinessAnalyticsEvent`
  ADD CONSTRAINT `BusinessAnalyticsEvent_businessId_fkey`
    FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `BusinessAnalyticsEvent_actorUserId_fkey`
    FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
