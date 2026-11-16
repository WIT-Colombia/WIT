-- Restricción administrativa persistente para que el negocio no pueda eludir una medida.
ALTER TABLE `BusinessOffer`
  ADD COLUMN `administrativeStatus` ENUM('NONE','HIDDEN','REVIEW','DELETED') NOT NULL DEFAULT 'NONE',
  ADD COLUMN `adminRestrictedAt` DATETIME(3) NULL;
CREATE INDEX `BusinessOffer_administrativeStatus_deletedAt_idx`
  ON `BusinessOffer`(`administrativeStatus`,`deletedAt`);
