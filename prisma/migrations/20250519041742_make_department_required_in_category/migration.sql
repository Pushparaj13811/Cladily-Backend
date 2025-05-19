/*
  Warnings:

  - Made the column `departmentId` on table `Category` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `Category` DROP FOREIGN KEY `Category_departmentId_fkey`;

-- DropIndex
DROP INDEX `Category_departmentId_fkey` ON `Category`;

-- AlterTable
ALTER TABLE `Category` MODIFY `departmentId` VARCHAR(191) NOT NULL;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
