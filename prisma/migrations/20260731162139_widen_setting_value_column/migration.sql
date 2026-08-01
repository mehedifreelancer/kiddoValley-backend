/*
  Warnings:

  - The primary key for the `settings` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE `settings` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `value` TEXT NOT NULL,
    MODIFY `type` VARCHAR(191) NULL,
    ADD PRIMARY KEY (`id`);
