CREATE TABLE `AdminRoleAssignment` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `role` ENUM('ADMIN', 'SUPER_ADMIN') NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `assignedById` CHAR(36) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `AdminRoleAssignment_userId_role_key` (`userId`, `role`),
    INDEX `AdminRoleAssignment_userId_active_idx` (`userId`, `active`),
    INDEX `AdminRoleAssignment_role_active_idx` (`role`, `active`),
    CONSTRAINT `AdminRoleAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `AdminRoleAssignment_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `AdminPermissionGrant` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `permission` ENUM('BUSINESSES_READ', 'CATALOG_READ', 'REPORTS_REVIEW', 'CONTENT_MODERATE', 'AUDIT_READ', 'ADMINS_MANAGE') NOT NULL,
    `granted` BOOLEAN NOT NULL DEFAULT true,
    `grantedById` CHAR(36) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `AdminPermissionGrant_userId_permission_key` (`userId`, `permission`),
    INDEX `AdminPermissionGrant_userId_granted_idx` (`userId`, `granted`),
    CONSTRAINT `AdminPermissionGrant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `AdminPermissionGrant_grantedById_fkey` FOREIGN KEY (`grantedById`) REFERENCES `User` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AuditLog` MODIFY `entityType` ENUM('USER', 'BUSINESS_ACCOUNT', 'BUSINESS', 'MEMBERSHIP', 'OWNERSHIP_TRANSFER', 'OFFER', 'PHOTO', 'VISIBILITY_PERIOD', 'ADMIN_SECURITY') NOT NULL;
