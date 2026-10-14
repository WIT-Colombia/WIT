CREATE TABLE `BusinessSecondaryCategory` (
    `businessId` CHAR(36) NOT NULL,
    `categoryId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `BusinessSecondaryCategory_categoryId_businessId_idx`(`categoryId`, `businessId`),
    PRIMARY KEY (`businessId`, `categoryId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BusinessSecondaryCategory` ADD CONSTRAINT `BusinessSecondaryCategory_businessId_fkey` FOREIGN KEY (`businessId`) REFERENCES `Business`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `BusinessSecondaryCategory` ADD CONSTRAINT `BusinessSecondaryCategory_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
