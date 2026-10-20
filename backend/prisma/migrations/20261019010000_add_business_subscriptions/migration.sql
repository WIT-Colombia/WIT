CREATE TABLE `BusinessSubscription` (
    `id` CHAR(36) NOT NULL,
    `businessId` CHAR(36) NOT NULL,
    `plan` ENUM('PRO') NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
    `startsAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `autoRenew` BOOLEAN NOT NULL DEFAULT true,
    `specialActivation` BOOLEAN NOT NULL DEFAULT false,
    `revokedAt` DATETIME(3) NULL,
    `revocationReason` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `BusinessSubscription_businessId_status_startsAt_expiresAt_idx` (`businessId`, `status`, `startsAt`, `expiresAt`),
    INDEX `BusinessSubscription_businessId_plan_status_idx` (`businessId`, `plan`, `status`),
    CONSTRAINT `BusinessSubscription_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
