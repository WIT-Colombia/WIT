-- Administrative refund review intake only. No transfer or payout execution.
-- Approved deployment must apply this migration before /admin/finance/refund-cases.
CREATE TABLE `RefundCase` (
  `id` CHAR(36) NOT NULL,
  `status` ENUM('OPEN','IN_REVIEW','NEEDS_INFORMATION','CLOSED') NOT NULL DEFAULT 'OPEN',
  `subject` VARCHAR(160) NOT NULL,
  `contactEmail` VARCHAR(320) NULL,
  `externalReference` VARCHAR(160) NULL,
  `requestedAmountCop` DECIMAL(14,2) NULL,
  `description` VARCHAR(2000) NOT NULL,
  `decisionNote` VARCHAR(1500) NULL,
  `createdById` CHAR(36) NOT NULL,
  `lastReviewedById` CHAR(36) NULL,
  `closedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `RefundCase_status_createdAt_idx` (`status`,`createdAt`),
  INDEX `RefundCase_createdAt_idx` (`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
