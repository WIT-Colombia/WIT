-- Incremental, additive migration. It does not alter existing rows.
CREATE TABLE `BusinessVerificationRequest` (
  `id` CHAR(36) NOT NULL,
  `businessId` CHAR(36) NOT NULL,
  `requesterId` CHAR(36) NOT NULL,
  `status` ENUM('PENDING','INFORMATION','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `businessNameAtRequest` VARCHAR(180) NOT NULL,
  `documentType` VARCHAR(80) NOT NULL,
  `documentSizeBytes` INT UNSIGNED NOT NULL,
  `documentSha256` CHAR(64) NOT NULL,
  `documentStorageKey` VARCHAR(512) NOT NULL,
  `documentDeletionStatus` ENUM('ACTIVE','PENDING','DELETED','FAILED') NOT NULL DEFAULT 'ACTIVE',
  `activeKey` CHAR(36) NULL,
  `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `resolvedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `BusinessVerificationRequest_businessId_activeKey_key` (`businessId`,`activeKey`),
  INDEX `BusinessVerificationRequest_businessId_status_updatedAt_idx` (`businessId`,`status`,`updatedAt`),
  INDEX `BusinessVerificationRequest_requesterId_requestedAt_idx` (`requesterId`,`requestedAt`),
  INDEX `BusinessVerificationRequest_documentDeletionStatus_updatedAt_idx` (`documentDeletionStatus`,`updatedAt`),
  CONSTRAINT `BusinessVerificationRequest_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessVerificationRequest_requesterId_fkey` FOREIGN KEY (`requesterId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BusinessVerificationDecision` (
  `id` CHAR(36) NOT NULL,
  `requestId` CHAR(36) NOT NULL,
  `adminId` CHAR(36) NOT NULL,
  `action` ENUM('APPROVE','REQUEST_INFORMATION','REJECT') NOT NULL,
  `reason` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `BusinessVerificationDecision_requestId_createdAt_idx` (`requestId`,`createdAt`),
  INDEX `BusinessVerificationDecision_adminId_createdAt_idx` (`adminId`,`createdAt`),
  CONSTRAINT `BusinessVerificationDecision_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `BusinessVerificationRequest` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessVerificationDecision_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
