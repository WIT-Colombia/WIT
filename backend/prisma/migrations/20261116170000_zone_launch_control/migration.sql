-- Lanzamientos territoriales: no restringen registros; controlan exclusivamente visibilidad pública.
CREATE TABLE `ZoneLaunch` (
  `id` CHAR(36) NOT NULL,
  `scope` ENUM('MUNICIPALITY','DEPARTMENT') NOT NULL,
  `code` VARCHAR(5) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `state` ENUM('CLOSED','SCHEDULED','OPEN','PAUSED') NOT NULL DEFAULT 'CLOSED',
  `opensAt` DATETIME(3) NULL,
  `updatedById` CHAR(36) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ZoneLaunch_scope_code_key` (`scope`,`code`),
  INDEX `ZoneLaunch_state_opensAt_idx` (`state`,`opensAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AuditLog` MODIFY `entityType`
  ENUM('USER','BUSINESS_ACCOUNT','BUSINESS','MEMBERSHIP','OWNERSHIP_TRANSFER','OFFER','PHOTO','VISIBILITY_PERIOD','ADMIN_SECURITY','ZONE') NOT NULL;

-- Palmira es la única localidad física inicialmente habilitada. La modalidad VIRTUAL es global.
-- Todos los demás municipios son CLOSED mientras no exista una decisión administrativa de apertura.
INSERT INTO `ZoneLaunch` (`id`,`scope`,`code`,`name`,`state`,`opensAt`,`updatedById`,`createdAt`,`updatedAt`)
VALUES (UUID(),'MUNICIPALITY','76520','Palmira','OPEN',NULL,NULL,CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));
