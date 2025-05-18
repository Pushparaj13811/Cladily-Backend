-- AlterTable
ALTER TABLE `Category` ADD COLUMN `department` ENUM('Menswear', 'Womenswear', 'Kidswear') NOT NULL DEFAULT 'Menswear';
