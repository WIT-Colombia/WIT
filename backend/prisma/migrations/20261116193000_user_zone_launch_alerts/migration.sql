-- Avisos internos por usuario y municipio; una suscripción por cuenta/ciudad.
-- El esquema anterior de alertas por email permanece para no perder avisos previamente consentidos.
CREATE TABLE `ZoneLaunchUserAlert` (
  `id` CHAR(36) NOT NULL,
  `userId` CHAR(36) NOT NULL,
  `code` VARCHAR(5) NOT NULL,
  `notifiedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ZoneLaunchUserAlert_userId_code_key` (`userId`,`code`),
  INDEX `ZoneLaunchUserAlert_notifiedAt_code_idx` (`notifiedAt`,`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ZoneLaunchUserAlert`
  ADD CONSTRAINT `ZoneLaunchUserAlert_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
