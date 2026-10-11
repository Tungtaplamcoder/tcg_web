-- Real-time detail-page view counters powering the admin "Top Viewed" widget.
-- Products and Virtual Boxes each track a monotonic `view_count`, incremented
-- whenever a user opens the matching storefront detail page.

-- AlterTable
ALTER TABLE `Product` ADD COLUMN `view_count` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `Product_viewCount_idx` ON `Product`(`view_count`);

-- AlterTable
ALTER TABLE `VirtualBox` ADD COLUMN `view_count` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `VirtualBox_viewCount_idx` ON `VirtualBox`(`view_count`);
