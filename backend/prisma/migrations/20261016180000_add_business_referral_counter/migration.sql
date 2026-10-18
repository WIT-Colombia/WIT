CREATE TABLE `BusinessReferralCounter` (
  `businessId` CHAR(36) NOT NULL,
  `validReferralCount` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`businessId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BusinessReferral` (
  `id` CHAR(36) NOT NULL,
  `businessId` CHAR(36) NOT NULL,
  `referredUserId` CHAR(36) NOT NULL,
  `validatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `BusinessReferral_businessId_referredUserId_key`(`businessId`, `referredUserId`),
  INDEX `BusinessReferral_referredUserId_idx`(`referredUserId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BusinessReferralCounter`
  ADD CONSTRAINT `BusinessReferralCounter_businessId_fkey`
  FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BusinessReferral`
  ADD CONSTRAINT `BusinessReferral_businessId_fkey`
  FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `BusinessReferral`
  ADD CONSTRAINT `BusinessReferral_referredUserId_fkey`
  FOREIGN KEY (`referredUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
