-- Zonas abiertas por el administrador; los registros de usuarios y negocios siguen permitidos en toda Colombia.
CREATE TABLE `ExpansionZone` (
  `id` CHAR(36) NOT NULL,
  `key` VARCHAR(240) NOT NULL,
  `level` VARCHAR(16) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `department` VARCHAR(160) NULL,
  `countryCode` CHAR(2) NOT NULL DEFAULT 'CO',
  `status` VARCHAR(16) NOT NULL DEFAULT 'CLOSED',
  `opensAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedById` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ExpansionZone_key_key` (`key`),
  INDEX `ExpansionZone_status_opensAt_idx` (`status`, `opensAt`),
  INDEX `ExpansionZone_level_department_name_idx` (`level`, `department`, `name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ExpansionZoneAudit` (
  `id` CHAR(36) NOT NULL,
  `zoneId` CHAR(36) NOT NULL,
  `actorUserId` CHAR(36) NOT NULL,
  `action` VARCHAR(32) NOT NULL,
  `previous` JSON NULL,
  `current` JSON NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ExpansionZoneAudit_zoneId_createdAt_idx` (`zoneId`, `createdAt`),
  INDEX `ExpansionZoneAudit_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Palma de lanzamiento: abrir únicamente Palmira. El ámbito virtual es global y se valida por modalidad activa.
INSERT INTO `ExpansionZone`
  (`id`, `key`, `level`, `name`, `department`, `countryCode`, `status`)
VALUES
  (UUID(), 'co|municipality|valle del cauca|palmira', 'MUNICIPALITY', 'Palmira', 'Valle del Cauca', 'CO', 'ACTIVE');
