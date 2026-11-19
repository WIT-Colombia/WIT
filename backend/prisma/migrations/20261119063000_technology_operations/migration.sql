-- Casework only. No production deployment or uptime is inferred from these rows.
CREATE TABLE `TechnologyCase` (
  `id` CHAR(36) NOT NULL,
  `kind` ENUM('INCIDENT','MAINTENANCE','NEED') NOT NULL,
  `status` ENUM('OPEN','PLANNED','IN_PROGRESS','BLOCKED','RESOLVED','COMPLETED','CANCELLED') NOT NULL,
  `severity` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
  `title` VARCHAR(160) NOT NULL,
  `description` VARCHAR(2000) NOT NULL,
  `component` VARCHAR(120) NULL,
  `scheduledStartAt` DATETIME(3) NULL,
  `scheduledEndAt` DATETIME(3) NULL,
  `completedAt` DATETIME(3) NULL,
  `createdById` CHAR(36) NOT NULL,
  `updatedById` CHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `TechnologyCase_kind_status_createdAt_idx` (`kind`,`status`,`createdAt`),
  INDEX `TechnologyCase_scheduledStartAt_kind_idx` (`scheduledStartAt`,`kind`),
  INDEX `TechnologyCase_createdAt_idx` (`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TechnologyCaseEvent` (
  `id` CHAR(36) NOT NULL,
  `caseId` CHAR(36) NOT NULL,
  `actorUserId` CHAR(36) NOT NULL,
  `action` VARCHAR(50) NOT NULL,
  `fromStatus` ENUM('OPEN','PLANNED','IN_PROGRESS','BLOCKED','RESOLVED','COMPLETED','CANCELLED') NULL,
  `toStatus` ENUM('OPEN','PLANNED','IN_PROGRESS','BLOCKED','RESOLVED','COMPLETED','CANCELLED') NULL,
  `reason` VARCHAR(500) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `TechnologyCaseEvent_caseId_createdAt_idx` (`caseId`,`createdAt`),
  INDEX `TechnologyCaseEvent_actorUserId_createdAt_idx` (`actorUserId`,`createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
ALTER TABLE `TechnologyCaseEvent` ADD CONSTRAINT `TechnologyCaseEvent_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `TechnologyCase`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
