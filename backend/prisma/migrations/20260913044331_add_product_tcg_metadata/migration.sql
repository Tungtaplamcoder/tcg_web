-- AlterTable
ALTER TABLE `Product` ADD COLUMN `cardSet` VARCHAR(191) NULL,
    ADD COLUMN `language` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Product_language_idx` ON `Product`(`language`);

-- CreateIndex
CREATE INDEX `Product_cardSet_idx` ON `Product`(`cardSet`);
