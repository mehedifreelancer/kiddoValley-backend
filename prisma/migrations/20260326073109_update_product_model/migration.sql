/*
  Warnings:

  - You are about to drop the column `stockQuantity` on the `products` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `products` DROP COLUMN `stockQuantity`,
    ADD COLUMN `description` VARCHAR(191) NULL;
