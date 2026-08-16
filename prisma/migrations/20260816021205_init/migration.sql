/*
  Warnings:

  - Added the required column `estimatedEndDate` to the `campaigns` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `campaigns` ADD COLUMN `estimatedEndDate` DATETIME(3) NOT NULL;
