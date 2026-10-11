-- Dynamic sealed-product category catalogue ("Danh mục Sealed Product").
-- Mirrors the dynamic `Rarity` catalogue so sealed sub-types (Booster Box,
-- ETB, Special Collection, …) are DB-driven and bound to the product modal.

-- CreateTable
CREATE TABLE `SealedCategory` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SealedCategory_name_key`(`name`),
    UNIQUE INDEX `SealedCategory_code_key`(`code`),
    INDEX `SealedCategory_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- SeedData: canonical sealed product types (idempotent — production DBs are
-- populated on `prisma migrate deploy`).
INSERT IGNORE INTO `SealedCategory` (`id`, `name`, `code`, `description`, `isActive`, `createdAt`, `updatedAt`) VALUES
    ('sealed-booster-box', 'Booster Box', 'booster-box', 'Hộp booster niêm phong nguyên seal', true, NOW(3), NOW(3)),
    ('sealed-etb', 'Elite Trainer Box (ETB)', 'elite-trainer-box', 'Elite Trainer Box (ETB)', true, NOW(3), NOW(3)),
    ('sealed-special-collection', 'Special Collection', 'special-collection', 'Bộ sưu tập đặc biệt', true, NOW(3), NOW(3)),
    ('sealed-blister-pack', 'Blister Pack', 'blister-pack', 'Gói blister kèm 1 booster', true, NOW(3), NOW(3)),
    ('sealed-mini-tin', 'Mini Tin', 'mini-tin', 'Hộp thiếc mini', true, NOW(3), NOW(3)),
    ('sealed-display-case', 'Display Case', 'display-case', 'Thùng display nhiều booster box', true, NOW(3), NOW(3));
