-- One-time restoration requested by the platform owner.
-- This does NOT create, extend, or bill for individual Business PRO subscriptions.
-- The superadministrator retains full control of subsequent changes in Admin.
-- Record the transition (if any) in the same administrative security audit used by Admin.
INSERT INTO `AuditLog`
  (`id`, `actorUserId`, `entityType`, `entityId`, `action`, `previousState`, `newState`, `reason`, `createdAt`)
SELECT UUID(), NULL, 'ADMIN_SECURITY', 'businessPro', 'PAID_PLAN_AVAILABILITY_CHANGED',
  JSON_OBJECT('key', 'businessPro', 'enabled', FALSE),
  JSON_OBJECT('key', 'businessPro', 'enabled', TRUE),
  'Reactivacion excepcional de Business PRO solicitada por el titular desde Xamuko (despliegue controlado).',
  CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `PaidPlanAvailability` WHERE `key` = 'businessPro' AND `enabled` = TRUE
);

INSERT INTO `PaidPlanAvailability` (`key`, `enabled`, `updatedAt`)
VALUES ('businessPro', TRUE, CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE `enabled` = TRUE, `updatedAt` = CURRENT_TIMESTAMP(3);
