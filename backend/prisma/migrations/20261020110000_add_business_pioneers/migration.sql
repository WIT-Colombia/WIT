CREATE TABLE `BusinessBrand` (
  `id` CHAR(36) NOT NULL,
  `legalName` VARCHAR(180) NOT NULL,
  `normalizedName` VARCHAR(180) NOT NULL,
  `verification` ENUM('UNVERIFIED','PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'UNVERIFIED',
  `evidenceSummary` TEXT NULL,
  `verifiedAt` DATETIME(3) NULL,
  `verifiedById` CHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `BusinessBrand_verification_updatedAt_idx` (`verification`,`updatedAt`),
  CONSTRAINT `BusinessBrand_verifiedById_fkey` FOREIGN KEY (`verifiedById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `BusinessClaim` (
  `id` CHAR(36) NOT NULL, `businessId` CHAR(36) NOT NULL, `brandId` CHAR(36) NULL, `claimantId` CHAR(36) NOT NULL,
  `status` ENUM('UNCLAIMED','PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING', `evidenceType` VARCHAR(40) NOT NULL, `evidenceNote` TEXT NULL,
  `reviewedById` CHAR(36) NULL, `reviewedAt` DATETIME(3) NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`), KEY `BusinessClaim_businessId_status_idx` (`businessId`,`status`), KEY `BusinessClaim_brandId_status_idx` (`brandId`,`status`),
  CONSTRAINT `BusinessClaim_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessClaim_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `BusinessBrand` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `BusinessClaim_claimantId_fkey` FOREIGN KEY (`claimantId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `BusinessClaim_reviewedById_fkey` FOREIGN KEY (`reviewedById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `PioneerAssignment` (
  `id` CHAR(36) NOT NULL, `brandId` CHAR(36) NOT NULL, `number` TINYINT UNSIGNED NOT NULL, `assignedById` CHAR(36) NOT NULL, `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`), UNIQUE KEY `PioneerAssignment_brandId_key` (`brandId`), UNIQUE KEY `PioneerAssignment_number_key` (`number`), KEY `PioneerAssignment_number_idx` (`number`),
  CONSTRAINT `PioneerAssignment_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `BusinessBrand` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PioneerAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `Business` ADD COLUMN `brandId` CHAR(36) NULL, ADD INDEX `Business_brandId_idx` (`brandId`), ADD CONSTRAINT `Business_brandId_fkey` FOREIGN KEY (`brandId`) REFERENCES `BusinessBrand` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `AdminPermissionGrant` MODIFY `permission` ENUM('BUSINESSES_READ','CATALOG_READ','REPORTS_REVIEW','CONTENT_MODERATE','AUDIT_READ','ADMINS_MANAGE','PIONEER_MANAGE') NOT NULL;
