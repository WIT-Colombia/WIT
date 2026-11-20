-- One-time exit from the Xamuko Plus demonstration/early request rollout.
-- Preserve historical migrations and subscription data. The former
-- 20261119213000 migration enabled the global switch automatically.
-- A real administrator may re-enable Plus later from Admin, with audited
-- justification; application restarts and re-deploys must not reset it.
--
-- Record the previous enabled state before changing it. A database that is
-- already disabled does not generate a spurious audit transition.
INSERT INTO `AuditLog`
  (`id`, `actorUserId`, `entityType`, `entityId`, `action`,
   `previousState`, `newState`, `reason`, `createdAt`)
SELECT UUID(), NULL, 'ADMIN_SECURITY', 'xamukoPlus', 'PAID_PLAN_AVAILABILITY_CHANGED',
  JSON_OBJECT('key', 'xamukoPlus', 'enabled', TRUE),
  JSON_OBJECT('key', 'xamukoPlus', 'enabled', FALSE),
  'Cierre autorizado del modo de demostración: Xamuko Plus permanece deshabilitado hasta su activación expresa y auditada desde Admin.',
  CURRENT_TIMESTAMP(3)
FROM `PaidPlanAvailability`
WHERE `key` = 'xamukoPlus' AND `enabled` = TRUE;

INSERT INTO `PaidPlanAvailability` (`key`, `enabled`, `updatedAt`)
VALUES ('xamukoPlus', FALSE, CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  `enabled` = FALSE,
  `updatedAt` = CURRENT_TIMESTAMP(3);

-- Do not change businessPro, purchase requests, memberships, watch lists,
-- collections, favorites or saved notification preferences.
