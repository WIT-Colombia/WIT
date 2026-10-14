-- AlterTable
ALTER TABLE `BusinessLocation` ADD COLUMN `visibility` ENUM('PUBLIC', 'PRIVATE') NOT NULL DEFAULT 'PRIVATE';

-- CreateTable
CREATE TABLE `BusinessModality` (
    `id` CHAR(36) NOT NULL,
    `businessId` CHAR(36) NOT NULL,
    `type` ENUM('PHYSICAL', 'VIRTUAL', 'DELIVERY') NOT NULL,
    `status` ENUM('CONFIGURING', 'ACTIVE', 'PAUSED') NOT NULL DEFAULT 'CONFIGURING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BusinessModality_businessId_status_idx`(`businessId`, `status`),
    INDEX `BusinessModality_type_status_idx`(`type`, `status`),
    UNIQUE INDEX `BusinessModality_businessId_type_key`(`businessId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessModalityContact` (
    `id` CHAR(36) NOT NULL,
    `modalityId` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NULL,
    `website` VARCHAR(2048) NULL,
    `phone` VARCHAR(32) NULL,
    `whatsapp` VARCHAR(32) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BusinessModalityContact_modalityId_key`(`modalityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessModalityHour` (
    `id` CHAR(36) NOT NULL,
    `modalityId` CHAR(36) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `isClosed` BOOLEAN NOT NULL DEFAULT false,
    `opensAt` VARCHAR(5) NULL,
    `closesAt` VARCHAR(5) NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'UTC',
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BusinessModalityHour_modalityId_isClosed_idx`(`modalityId`, `isClosed`),
    UNIQUE INDEX `BusinessModalityHour_modalityId_dayOfWeek_key`(`modalityId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BusinessModality` ADD CONSTRAINT `BusinessModality_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessModalityContact` ADD CONSTRAINT `BusinessModalityContact_modalityId_fkey` FOREIGN KEY (`modalityId`) REFERENCES `BusinessModality`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessModalityHour` ADD CONSTRAINT `BusinessModalityHour_modalityId_fkey` FOREIGN KEY (`modalityId`) REFERENCES `BusinessModality`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
