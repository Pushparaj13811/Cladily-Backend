-- AlterTable
ALTER TABLE `Product` ADD COLUMN `care` JSON NULL,
    ADD COLUMN `colors` JSON NULL,
    ADD COLUMN `features` JSON NULL,
    ADD COLUMN `material` VARCHAR(191) NULL,
    ADD COLUMN `sizes` JSON NULL,
    ADD COLUMN `subcategory` VARCHAR(191) NULL;
