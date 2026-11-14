-- Products and services reported from XAMUKO Usuarios.
-- Reports are persisted server-side and visible to authorized Admin users.
CREATE TABLE `OfferReport` (
  `id` CHAR(36) NOT NULL,
  `offerId` CHAR(36) NOT NULL,
  `reporterId` CHAR(36) NULL,
  `reason` ENUM('UNAVAILABLE','WRONG_INFORMATION','WRONG_IMAGE','OTHER') NOT NULL,
  `description` VARCHAR(500) NULL,
  `status` ENUM('PENDING','UNDER_REVIEW','RESOLVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `decisionNote` VARCHAR(1500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `OfferReport_status_createdAt_idx` (`status`, `createdAt`),
  INDEX `OfferReport_offerId_createdAt_idx` (`offerId`, `createdAt`),
  INDEX `OfferReport_reporterId_createdAt_idx` (`reporterId`, `createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `OfferReport_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `BusinessOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OfferReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
