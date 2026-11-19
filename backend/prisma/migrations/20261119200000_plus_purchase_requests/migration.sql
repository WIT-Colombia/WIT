-- A purchase request is not proof of payment and never activates Plus.
CREATE TABLE `UserPlusPurchaseRequest` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'PENDING_PAYMENT',
  `amountCop` INTEGER NOT NULL DEFAULT 4900,
  `currency` CHAR(3) NOT NULL DEFAULT 'COP',
  `periodMonths` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `closedAt` DATETIME(3) NULL,
  INDEX `UserPlusPurchaseRequest_userId_status_createdAt_idx`(`userId`,`status`,`createdAt`),
  INDEX `UserPlusPurchaseRequest_status_createdAt_idx`(`status`,`createdAt`),
  PRIMARY KEY (`id`),
  CONSTRAINT `UserPlusPurchaseRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
