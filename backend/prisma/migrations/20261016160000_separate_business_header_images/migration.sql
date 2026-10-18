-- Keep gallery assets separate from the two images used in the business header.
ALTER TABLE `Photo`
  ADD COLUMN `isGallery` BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE `Business`
  ADD COLUMN `coverPhotoId` CHAR(36) NULL,
  ADD COLUMN `profilePhotoId` CHAR(36) NULL,
  ADD COLUMN `coverImagePositionX` TINYINT UNSIGNED NOT NULL DEFAULT 50,
  ADD COLUMN `coverImagePositionY` TINYINT UNSIGNED NOT NULL DEFAULT 50,
  ADD COLUMN `profileImagePositionX` TINYINT UNSIGNED NOT NULL DEFAULT 50,
  ADD COLUMN `profileImagePositionY` TINYINT UNSIGNED NOT NULL DEFAULT 50;

-- Existing businesses keep their current appearance until either image changes.
UPDATE `Business` AS `business`
JOIN (
  SELECT `businessId`, SUBSTRING_INDEX(GROUP_CONCAT(`id` ORDER BY `sortOrder` ASC, `createdAt` ASC), ',', 1) AS `photoId`
  FROM `Photo`
  WHERE `businessId` IS NOT NULL AND `isCover` = true
  GROUP BY `businessId`
) AS `currentCover` ON `currentCover`.`businessId` = `business`.`id`
SET `business`.`coverPhotoId` = `currentCover`.`photoId`,
    `business`.`profilePhotoId` = `currentCover`.`photoId`;

CREATE UNIQUE INDEX `Business_coverPhotoId_key` ON `Business`(`coverPhotoId`);
CREATE UNIQUE INDEX `Business_profilePhotoId_key` ON `Business`(`profilePhotoId`);

ALTER TABLE `Business`
  ADD CONSTRAINT `Business_coverPhotoId_fkey`
  FOREIGN KEY (`coverPhotoId`) REFERENCES `Photo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `Business_profilePhotoId_fkey`
  FOREIGN KEY (`profilePhotoId`) REFERENCES `Photo`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
