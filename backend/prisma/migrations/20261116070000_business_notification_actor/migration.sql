-- Optional originator; removed users automatically lose their portrait association.
ALTER TABLE `BusinessNotification`
  ADD COLUMN `actorUserId` CHAR(36) NULL;

CREATE INDEX `BusinessNotification_actorUserId_idx`
  ON `BusinessNotification`(`actorUserId`);

ALTER TABLE `BusinessNotification`
  ADD CONSTRAINT `BusinessNotification_actorUserId_fkey`
  FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
