-- A registration request is not a real User until the mailbox owner confirms.
-- Only hashed single-use tokens and an Argon2 password hash are persisted temporarily.
CREATE TABLE `PendingEmailRegistration` (
  `id` CHAR(36) NOT NULL,
  `emailNormalized` VARCHAR(320) NOT NULL,
  `displayName` VARCHAR(120) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `referralCode` VARCHAR(40) NULL,
  `application` VARCHAR(16) NOT NULL DEFAULT 'usuario',
  `tokenHash` VARCHAR(64) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `PendingEmailRegistration_emailNormalized_key`(`emailNormalized`),
  UNIQUE INDEX `PendingEmailRegistration_tokenHash_key`(`tokenHash`),
  INDEX `PendingEmailRegistration_expiresAt_idx`(`expiresAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
