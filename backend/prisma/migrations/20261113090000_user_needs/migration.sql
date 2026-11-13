CREATE TABLE `UserNeed` (
 `id` CHAR(36) NOT NULL,
 `userId` CHAR(36) NOT NULL,
 `title` VARCHAR(90) NOT NULL,
 `category` VARCHAR(160) NOT NULL,
 `description` VARCHAR(320) NOT NULL,
 `locationId` VARCHAR(160) NOT NULL,
 `locationName` VARCHAR(240) NOT NULL,
 `locationContext` VARCHAR(240) NOT NULL,
 `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
 `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
 `updatedAt` DATETIME(3) NOT NULL,
 PRIMARY KEY (`id`),
 INDEX `UserNeed_createdAt_idx`(`createdAt`),
 INDEX `UserNeed_status_createdAt_idx`(`status`,`createdAt`),
 INDEX `UserNeed_userId_createdAt_idx`(`userId`,`createdAt`),
 CONSTRAINT `UserNeed_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
