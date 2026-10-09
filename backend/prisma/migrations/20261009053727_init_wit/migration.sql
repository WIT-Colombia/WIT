-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(36) NOT NULL,
    `publicId` VARCHAR(64) NOT NULL,
    `emailNormalized` VARCHAR(320) NULL,
    `displayName` VARCHAR(120) NOT NULL,
    `phoneCountryCode` VARCHAR(8) NULL,
    `phoneNumber` VARCHAR(32) NULL,
    `avatarUrl` VARCHAR(2048) NULL,
    `locale` VARCHAR(16) NOT NULL DEFAULT 'es-CO',
    `status` ENUM('ACTIVE', 'SUSPENDED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_publicId_key`(`publicId`),
    UNIQUE INDEX `User_emailNormalized_key`(`emailNormalized`),
    INDEX `User_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthIdentity` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `provider` ENUM('EMAIL', 'GOOGLE', 'APPLE', 'FACEBOOK') NOT NULL,
    `providerSubject` VARCHAR(255) NOT NULL,
    `passwordHash` VARCHAR(255) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AuthIdentity_userId_idx`(`userId`),
    UNIQUE INDEX `AuthIdentity_provider_providerSubject_key`(`provider`, `providerSubject`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` VARCHAR(255) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `userAgent` VARCHAR(512) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    INDEX `Session_userId_expiresAt_idx`(`userId`, `expiresAt`),
    INDEX `Session_revokedAt_idx`(`revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessAccount` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'CLOSED') NOT NULL DEFAULT 'ACTIVE',
    `createdById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BusinessAccount_createdById_status_idx`(`createdById`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Business` (
    `id` CHAR(36) NOT NULL,
    `publicId` VARCHAR(64) NOT NULL,
    `businessAccountId` CHAR(36) NOT NULL,
    `createdById` CHAR(36) NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `slug` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `categoryId` CHAR(36) NOT NULL,
    `email` VARCHAR(320) NULL,
    `website` VARCHAR(2048) NULL,
    `instagram` VARCHAR(255) NULL,
    `phone` VARCHAR(32) NULL,
    `whatsapp` VARCHAR(32) NULL,
    `completeness` INTEGER NOT NULL DEFAULT 0,
    `lifecycleStatus` ENUM('DRAFT', 'ACTIVE') NOT NULL DEFAULT 'DRAFT',
    `publicationStatus` ENUM('UNPUBLISHED', 'PUBLISHED', 'REVIEW') NOT NULL DEFAULT 'UNPUBLISHED',
    `visibilityStatus` ENUM('VISIBLE', 'HIDDEN', 'EXPIRED', 'REVIEW') NOT NULL DEFAULT 'REVIEW',
    `verificationStatus` ENUM('NONE', 'PENDING', 'INFORMATION', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'NONE',
    `deletionStatus` ENUM('NONE', 'RECOVERY', 'DELETED') NOT NULL DEFAULT 'NONE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Business_publicId_key`(`publicId`),
    INDEX `Business_businessAccountId_lifecycleStatus_idx`(`businessAccountId`, `lifecycleStatus`),
    INDEX `Business_publicationStatus_visibilityStatus_deletionStatus_idx`(`publicationStatus`, `visibilityStatus`, `deletionStatus`),
    INDEX `Business_categoryId_lifecycleStatus_idx`(`categoryId`, `lifecycleStatus`),
    INDEX `Business_createdById_idx`(`createdById`),
    UNIQUE INDEX `Business_businessAccountId_slug_key`(`businessAccountId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessMembership` (
    `id` CHAR(36) NOT NULL,
    `businessId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `role` ENUM('OWNER', 'COLLABORATOR') NOT NULL,
    `status` ENUM('INVITED', 'ACTIVE', 'REJECTED', 'REVOKED') NOT NULL DEFAULT 'INVITED',
    `invitedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acceptedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BusinessMembership_userId_status_idx`(`userId`, `status`),
    INDEX `BusinessMembership_businessId_role_status_idx`(`businessId`, `role`, `status`),
    UNIQUE INDEX `BusinessMembership_businessId_userId_key`(`businessId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessMembershipPermission` (
    `id` CHAR(36) NOT NULL,
    `membershipId` CHAR(36) NOT NULL,
    `permission` ENUM('EDIT_BUSINESS', 'MANAGE_CATALOG', 'MANAGE_PHOTOS', 'MANAGE_HOURS', 'READ_REVIEWS', 'MANAGE_COLLABORATORS', 'CHANGE_PUBLICATION', 'EXTEND_VISIBILITY', 'DELETE_BUSINESS', 'TRANSFER_OWNERSHIP') NOT NULL,
    `allowed` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BusinessMembershipPermission_membershipId_permission_key`(`membershipId`, `permission`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OwnershipTransfer` (
    `id` CHAR(36) NOT NULL,
    `businessId` CHAR(36) NOT NULL,
    `fromUserId` CHAR(36) NOT NULL,
    `toUserId` CHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `respondedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `reason` TEXT NULL,

    INDEX `OwnershipTransfer_businessId_status_idx`(`businessId`, `status`),
    INDEX `OwnershipTransfer_toUserId_status_idx`(`toUserId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CategoryTranslation` (
    `id` CHAR(36) NOT NULL,
    `categoryId` CHAR(36) NOT NULL,
    `locale` VARCHAR(16) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `iconKey` VARCHAR(100) NULL,

    INDEX `CategoryTranslation_locale_name_idx`(`locale`, `name`),
    UNIQUE INDEX `CategoryTranslation_categoryId_locale_key`(`categoryId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessOffer` (
    `id` CHAR(36) NOT NULL,
    `businessId` CHAR(36) NOT NULL,
    `categoryId` CHAR(36) NULL,
    `kind` ENUM('PRODUCT', 'SERVICE') NOT NULL,
    `name` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `priceAmount` DECIMAL(12, 2) NULL,
    `currency` CHAR(3) NULL,
    `priceText` VARCHAR(180) NULL,
    `negotiable` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `publicationStatus` ENUM('UNPUBLISHED', 'PUBLISHED', 'REVIEW') NOT NULL DEFAULT 'UNPUBLISHED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BusinessOffer_businessId_kind_active_idx`(`businessId`, `kind`, `active`),
    INDEX `BusinessOffer_categoryId_kind_idx`(`categoryId`, `kind`),
    INDEX `BusinessOffer_publicationStatus_idx`(`publicationStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessLocation` (
    `id` CHAR(36) NOT NULL,
    `businessId` CHAR(36) NOT NULL,
    `countryCode` CHAR(2) NOT NULL,
    `regionCode` VARCHAR(32) NULL,
    `regionName` VARCHAR(160) NULL,
    `cityName` VARCHAR(160) NOT NULL,
    `zoneName` VARCHAR(160) NULL,
    `address` VARCHAR(255) NOT NULL,
    `postalCode` VARCHAR(32) NULL,
    `latitude` DECIMAL(9, 6) NULL,
    `longitude` DECIMAL(9, 6) NULL,
    `googlePlaceId` VARCHAR(255) NULL,
    `geocodeSource` VARCHAR(64) NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'UTC',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BusinessLocation_businessId_key`(`businessId`),
    INDEX `BusinessLocation_countryCode_regionCode_cityName_idx`(`countryCode`, `regionCode`, `cityName`),
    INDEX `BusinessLocation_latitude_longitude_idx`(`latitude`, `longitude`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessHour` (
    `id` CHAR(36) NOT NULL,
    `businessId` CHAR(36) NOT NULL,
    `dayOfWeek` INTEGER NOT NULL,
    `isClosed` BOOLEAN NOT NULL DEFAULT false,
    `opensAt` VARCHAR(5) NULL,
    `closesAt` VARCHAR(5) NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'UTC',
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BusinessHour_businessId_isClosed_idx`(`businessId`, `isClosed`),
    UNIQUE INDEX `BusinessHour_businessId_dayOfWeek_key`(`businessId`, `dayOfWeek`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Photo` (
    `id` CHAR(36) NOT NULL,
    `businessId` CHAR(36) NULL,
    `offerId` CHAR(36) NULL,
    `storageKey` VARCHAR(1024) NOT NULL,
    `url` VARCHAR(2048) NULL,
    `source` ENUM('NEGOCIOS') NOT NULL DEFAULT 'NEGOCIOS',
    `altText` VARCHAR(255) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isCover` BOOLEAN NOT NULL DEFAULT false,
    `uploadedById` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Photo_businessId_sortOrder_idx`(`businessId`, `sortOrder`),
    INDEX `Photo_offerId_sortOrder_idx`(`offerId`, `sortOrder`),
    INDEX `Photo_uploadedById_idx`(`uploadedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BusinessVisibilityPeriod` (
    `id` CHAR(36) NOT NULL,
    `businessId` CHAR(36) NOT NULL,
    `kind` ENUM('INITIAL', 'MANUAL_EXTENSION', 'RESTORE') NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `requestedById` CHAR(36) NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BusinessVisibilityPeriod_businessId_startsAt_expiresAt_idx`(`businessId`, `startsAt`, `expiresAt`),
    INDEX `BusinessVisibilityPeriod_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` CHAR(36) NOT NULL,
    `actorUserId` CHAR(36) NULL,
    `entityType` ENUM('USER', 'BUSINESS_ACCOUNT', 'BUSINESS', 'MEMBERSHIP', 'OWNERSHIP_TRANSFER', 'OFFER', 'PHOTO', 'VISIBILITY_PERIOD') NOT NULL,
    `entityId` CHAR(36) NOT NULL,
    `action` VARCHAR(100) NOT NULL,
    `previousState` JSON NULL,
    `newState` JSON NULL,
    `reason` TEXT NULL,
    `comment` TEXT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_entityType_entityId_createdAt_idx`(`entityType`, `entityId`, `createdAt`),
    INDEX `AuditLog_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuthIdentity` ADD CONSTRAINT `AuthIdentity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessAccount` ADD CONSTRAINT `BusinessAccount_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Business` ADD CONSTRAINT `Business_businessAccountId_fkey` FOREIGN KEY (`businessAccountId`) REFERENCES `BusinessAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Business` ADD CONSTRAINT `Business_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Business` ADD CONSTRAINT `Business_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessMembership` ADD CONSTRAINT `BusinessMembership_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessMembership` ADD CONSTRAINT `BusinessMembership_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessMembershipPermission` ADD CONSTRAINT `BusinessMembershipPermission_membershipId_fkey` FOREIGN KEY (`membershipId`) REFERENCES `BusinessMembership`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnershipTransfer` ADD CONSTRAINT `OwnershipTransfer_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnershipTransfer` ADD CONSTRAINT `OwnershipTransfer_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OwnershipTransfer` ADD CONSTRAINT `OwnershipTransfer_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CategoryTranslation` ADD CONSTRAINT `CategoryTranslation_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessOffer` ADD CONSTRAINT `BusinessOffer_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessOffer` ADD CONSTRAINT `BusinessOffer_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessLocation` ADD CONSTRAINT `BusinessLocation_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessHour` ADD CONSTRAINT `BusinessHour_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Photo` ADD CONSTRAINT `Photo_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Photo` ADD CONSTRAINT `Photo_offerId_fkey` FOREIGN KEY (`offerId`) REFERENCES `BusinessOffer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Photo` ADD CONSTRAINT `Photo_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessVisibilityPeriod` ADD CONSTRAINT `BusinessVisibilityPeriod_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BusinessVisibilityPeriod` ADD CONSTRAINT `BusinessVisibilityPeriod_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

