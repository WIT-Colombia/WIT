ALTER TABLE `BusinessOffer` ADD COLUMN `internalCode` VARCHAR(7) NULL;

UPDATE `BusinessOffer` AS target
JOIN (
  SELECT `id`, CONCAT(CASE WHEN `kind` = 'PRODUCT' THEN 'P-' ELSE 'S-' END, LPAD(ROW_NUMBER() OVER (PARTITION BY `businessId`, `kind` ORDER BY `createdAt`, `id`), 4, '0')) AS `code`
  FROM `BusinessOffer`
) AS numbered ON numbered.`id` = target.`id`
SET target.`internalCode` = numbered.`code`;

ALTER TABLE `BusinessOffer` MODIFY COLUMN `internalCode` VARCHAR(7) NOT NULL;
CREATE UNIQUE INDEX `BusinessOffer_businessId_internalCode_key` ON `BusinessOffer`(`businessId`, `internalCode`);
