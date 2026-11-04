CREATE TABLE `BusinessReport` (
  `id` CHAR(36) NOT NULL,
  `businessId` CHAR(36) NOT NULL,
  `reporterId` CHAR(36) NULL,
  `reason` ENUM('IMPERSONATION','FALSE_INFORMATION','SUSPECTED_FRAUD','INAPPROPRIATE_CONTENT','OTHER') NOT NULL,
  `description` VARCHAR(1500) NOT NULL,
  `status` ENUM('PENDING','UNDER_REVIEW','RESOLVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `decisionNote` VARCHAR(1500) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `BusinessReport_status_createdAt_idx` (`status`,`createdAt`),
  INDEX `BusinessReport_businessId_createdAt_idx` (`businessId`,`createdAt`),
  INDEX `BusinessReport_reporterId_createdAt_idx` (`reporterId`,`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `BusinessReport_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
