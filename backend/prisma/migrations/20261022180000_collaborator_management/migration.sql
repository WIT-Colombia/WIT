ALTER TABLE `User`
  ADD COLUMN `nickname` VARCHAR(32) NULL,
  ADD UNIQUE INDEX `User_nickname_key` (`nickname`);

ALTER TABLE `BusinessMembership`
  MODIFY `status` ENUM('INVITED','ACTIVE','SUSPENDED','REJECTED','REVOKED') NOT NULL DEFAULT 'INVITED',
  ADD COLUMN `expiresAt` DATETIME(3) NULL;

CREATE TABLE `BusinessNotification` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `businessId` CHAR(36) NOT NULL,
  `membershipId` CHAR(36) NULL,
  `type` ENUM('COLLABORATION_INVITATION','COLLABORATION_UPDATE') NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `message` VARCHAR(500) NOT NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `BusinessNotification_userId_readAt_createdAt_idx` (`userId`,`readAt`,`createdAt`),
  INDEX `BusinessNotification_businessId_type_createdAt_idx` (`businessId`,`type`,`createdAt`),
  INDEX `BusinessNotification_membershipId_idx` (`membershipId`),
  CONSTRAINT `BusinessNotification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessNotification_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessNotification_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `BusinessMembership` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
