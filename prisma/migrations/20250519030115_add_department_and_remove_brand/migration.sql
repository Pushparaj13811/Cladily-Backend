/*
  Warnings:

  - You are about to drop the column `department` on the `Category` table. All the data in the column will be lost.
  - You are about to drop the column `brandId` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `brands` on the `ShoppingPreferences` table. All the data in the column will be lost.
  - You are about to drop the `Brand` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserPreferredBrand` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `Product` DROP FOREIGN KEY `Product_brandId_fkey`;

-- DropForeignKey
ALTER TABLE `UserPreferredBrand` DROP FOREIGN KEY `UserPreferredBrand_userId_fkey`;

-- DropIndex
DROP INDEX `Product_brandId_idx` ON `Product`;

-- AlterTable
ALTER TABLE `Category` DROP COLUMN `department`,
    ADD COLUMN `departmentId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Product` DROP COLUMN `brandId`,
    ADD COLUMN `departmentId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `ShoppingPreferences` DROP COLUMN `brands`;

-- DropTable
DROP TABLE `Brand`;

-- DropTable
DROP TABLE `UserPreferredBrand`;

-- CreateTable
CREATE TABLE `Department` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Department_name_key`(`name`),
    UNIQUE INDEX `Department_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Product_departmentId_idx` ON `Product`(`departmentId`);

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
