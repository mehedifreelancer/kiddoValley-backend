/*
  Warnings:

  - You are about to drop the `sold_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `sold_items` DROP FOREIGN KEY `sold_items_orderId_fkey`;

-- DropForeignKey
ALTER TABLE `sold_items` DROP FOREIGN KEY `sold_items_stockId_fkey`;

-- AlterTable
ALTER TABLE `order` ADD COLUMN `isSuspicious` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isWebsiteOrder` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `orderStatus` VARCHAR(191) NOT NULL DEFAULT 'new';

-- DropTable
DROP TABLE `sold_items`;

-- CreateTable
CREATE TABLE `SoldItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `productName` VARCHAR(191) NOT NULL,
    `variantSku` VARCHAR(191) NOT NULL,
    `variantAttributes` JSON NULL,
    `unitPrice` DOUBLE NOT NULL,
    `totalPrice` DOUBLE NOT NULL,
    `quantity` INTEGER NOT NULL,
    `productId` INTEGER NULL,
    `variantId` INTEGER NULL,
    `stockId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SoldItem` ADD CONSTRAINT `SoldItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SoldItem` ADD CONSTRAINT `SoldItem_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `stocks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
