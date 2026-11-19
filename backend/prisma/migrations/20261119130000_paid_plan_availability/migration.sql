CREATE TABLE `PaidPlanAvailability` (
  `key` VARCHAR(32) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
INSERT INTO `PaidPlanAvailability` (`key`, `enabled`, `updatedAt`) VALUES
('businessPro', false, CURRENT_TIMESTAMP(3)), ('xamukoPlus', false, CURRENT_TIMESTAMP(3));
