-- Add persistent likes for products and services without changing existing data.
CREATE TABLE `BusinessOfferLike` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `offerId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BusinessOfferLike_userId_offerId_key`(`userId`, `offerId`),
    INDEX `BusinessOfferLike_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `BusinessOfferLike_offerId_createdAt_idx`(`offerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `BusinessOfferLike`
  ADD CONSTRAINT `BusinessOfferLike_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `BusinessOfferLike_offerId_fkey`
    FOREIGN KEY (`offerId`) REFERENCES `BusinessOffer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
