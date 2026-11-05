-- Link actionable user-inbox invitations to their collaborator membership.
-- Existing notifications remain readable; only new invitations have a direct membership link.
ALTER TABLE `UserNotification`
  ADD COLUMN `membershipId` CHAR(36) NULL;

CREATE INDEX `UserNotification_membershipId_idx`
  ON `UserNotification` (`membershipId`);
