CREATE TABLE `ZoneOpeningInterest` (
  `id` CHAR(36) NOT NULL,
  `zoneKey` VARCHAR(240) NOT NULL,
  `emailNormalized` VARCHAR(320) NOT NULL,
  `confirmationHash` CHAR(64) NOT NULL,
  `unsubscribeToken` VARCHAR(64) NOT NULL,
  `consentAt` DATETIME(3) NOT NULL,
  `confirmedAt` DATETIME(3) NULL,
  `notifiedAt` DATETIME(3) NULL,
  `notificationLeaseAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ZoneOpeningInterest_zoneKey_emailNormalized_key` (`zoneKey`, `emailNormalized`),
  UNIQUE INDEX `ZoneOpeningInterest_unsubscribeToken_key` (`unsubscribeToken`),
  INDEX `ZoneOpeningInterest_zoneKey_confirmedAt_notifiedAt_idx` (`zoneKey`, `confirmedAt`, `notifiedAt`),
  INDEX `ZoneOpeningInterest_notificationLeaseAt_idx` (`notificationLeaseAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
