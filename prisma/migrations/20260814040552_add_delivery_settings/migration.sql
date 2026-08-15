-- CreateTable
CREATE TABLE `delivery_settings` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `weightTiers` JSON NOT NULL,
    `overweightInsideDhaka` DOUBLE NOT NULL DEFAULT 15,
    `overweightOutsideDhaka` DOUBLE NOT NULL DEFAULT 25,
    `codPercentage` DOUBLE NOT NULL DEFAULT 1,
    `deliveryDiscountPercent` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
