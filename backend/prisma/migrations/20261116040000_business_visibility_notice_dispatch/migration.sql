-- Idempotent, per-recipient delivery ledger. Do not reuse inbox row IDs because users may delete notices.
CREATE TABLE `BusinessLifecycleNoticeDispatch` (
    `id` CHAR(36) NOT NULL,
    `dedupeKey` VARCHAR(180) NOT NULL,
    `businessId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `event` VARCHAR(32) NOT NULL,
    `channel` VARCHAR(16) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `BusinessLifecycleNoticeDispatch_dedupeKey_key`(`dedupeKey`),
    INDEX `BusinessLifecycleNoticeDispatch_businessId_createdAt_idx`(`businessId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BusinessNotification` MODIFY `type` ENUM('COLLABORATION_INVITATION', 'COLLABORATION_UPDATE', 'VISIBILITY_REMINDER', 'VISIBILITY_EXPIRED') NOT NULL;
