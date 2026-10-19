ALTER TABLE `User`
  ADD COLUMN `preferredLocationCity` VARCHAR(160) NULL,
  ADD COLUMN `preferredLocationRegion` VARCHAR(160) NULL,
  ADD COLUMN `preferredLocationCountry` VARCHAR(80) NULL,
  ADD COLUMN `preferredLocationName` VARCHAR(240) NULL,
  ADD COLUMN `preferredLocationLatitude` DECIMAL(10,7) NULL,
  ADD COLUMN `preferredLocationLongitude` DECIMAL(10,7) NULL,
  ADD COLUMN `preferredLocationMode` VARCHAR(16) NULL,
  ADD COLUMN `preferredLocationResolution` VARCHAR(16) NULL,
  ADD COLUMN `preferredLocationUpdatedAt` DATETIME(3) NULL;
