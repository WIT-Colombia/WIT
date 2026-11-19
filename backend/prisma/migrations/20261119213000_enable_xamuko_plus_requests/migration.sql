-- Enable Xamuko Plus availability for subscription requests at COP 4,900/month.
-- This does not charge users or grant membership. Individual entitlements
-- still require a valid subscription, and the administrator can later disable
-- the plan with the audited master switch.
INSERT INTO `AuditLog`
  (`id`, `actorUserId`, `entityType`, `entityId`, `action`,
   `previousState`, `newState`, `reason`, `createdAt`)
SELECT UUID(), NULL, 'ADMIN_SECURITY', 'xamukoPlus', 'PAID_PLAN_AVAILABILITY_CHANGED',
  JSON_OBJECT('key', 'xamukoPlus', 'enabled', FALSE),
  JSON_OBJECT('key', 'xamukoPlus', 'enabled', TRUE),
  'Habilitación solicitada por el titular para recibir solicitudes de membresía Xamuko Plus a $4.900 COP mensuales, sin activar cobros.',
  CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `PaidPlanAvailability`
  WHERE `key` = 'xamukoPlus' AND `enabled` = TRUE
);
INSERT INTO `PaidPlanAvailability` (`key`, `enabled`, `updatedAt`)
VALUES ('xamukoPlus', TRUE, CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `enabled` = TRUE, `updatedAt` = CURRENT_TIMESTAMP(3);
