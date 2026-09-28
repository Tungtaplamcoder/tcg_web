-- Add hierarchical (parent -> series/era -> expansion set) category support
-- and an index on Product.artist for the new storefront facet filter.

-- AlterTable
ALTER TABLE `Category` ADD COLUMN `parentId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Category_parentId_idx` ON `Category`(`parentId`);

-- CreateIndex
CREATE INDEX `Product_artist_idx` ON `Product`(`artist`);

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
