-- DropIndex
DROP INDEX `Session_refreshToken_idx` ON `Session`;

-- DropIndex
DROP INDEX `Session_refreshToken_key` ON `Session`;

-- AlterTable
ALTER TABLE `Category` ADD COLUMN `iconUrl` VARCHAR(191) NULL,
    ADD COLUMN `isVisible` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `level` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `metaDescription` VARCHAR(191) NULL,
    ADD COLUMN `metaKeywords` VARCHAR(191) NULL,
    ADD COLUMN `metaTitle` VARCHAR(191) NULL,
    ADD COLUMN `path` VARCHAR(191) NOT NULL DEFAULT '/';

-- AlterTable
ALTER TABLE `Session` MODIFY `refreshToken` VARCHAR(1000) NULL;

-- CreateIndex
CREATE INDEX `Category_level_idx` ON `Category`(`level`);
