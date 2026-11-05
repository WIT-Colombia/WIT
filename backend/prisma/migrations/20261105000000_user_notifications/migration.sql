CREATE TABLE `UserNotification` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `body` VARCHAR(500) NOT NULL,
  `readAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `UserNotification_userId_readAt_createdAt_idx` (`userId`, `readAt`, `createdAt`),
  CONSTRAINT `UserNotification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
