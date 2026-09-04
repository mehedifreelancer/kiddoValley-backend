-- AlterTable
ALTER TABLE `hero_sliders` ADD COLUMN `bgColor` VARCHAR(191) NULL,
    ADD COLUMN `bgType` VARCHAR(191) NOT NULL DEFAULT 'image',
    MODIFY `bgImage` VARCHAR(191) NULL;
