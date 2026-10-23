ALTER TABLE `BusinessReview` DROP INDEX `BusinessReview_businessId_userId_key`;
ALTER TABLE `BusinessReview` MODIFY `status` ENUM('PUBLISHED','HIDDEN','REMOVED','REMOVED_BY_AUTHOR') NOT NULL DEFAULT 'PUBLISHED';
CREATE TABLE `BusinessReviewCooldown` (
  `id` CHAR(36) NOT NULL,
  `businessId` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `lastPublishedAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `BusinessReviewCooldown_businessId_userId_key` (`businessId`,`userId`),
  KEY `BusinessReviewCooldown_userId_lastPublishedAt_idx` (`userId`,`lastPublishedAt`),
  CONSTRAINT `BusinessReviewCooldown_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `BusinessReviewCooldown_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO `BusinessReviewCooldown` (`id`,`businessId`,`userId`,`lastPublishedAt`,`createdAt`,`updatedAt`)
SELECT UUID(), `businessId`, `userId`, MAX(`createdAt`), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `BusinessReview` GROUP BY `businessId`,`userId`;
