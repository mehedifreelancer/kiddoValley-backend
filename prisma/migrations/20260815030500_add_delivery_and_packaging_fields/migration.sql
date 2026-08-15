-- AlterTable
ALTER TABLE `orders` ADD COLUMN `deliveryCharge` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `packagingCost` DOUBLE NOT NULL DEFAULT 0;
