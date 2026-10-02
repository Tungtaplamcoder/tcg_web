-- Dynamic rarity catalogue ("Độ hiếm") — mirrors the previous hardcoded
-- frontend list so the admin product modal can manage rarities like
-- Series/Era and Expansion Sets.

-- CreateTable
CREATE TABLE `Rarity` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Rarity_name_key`(`name`),
    UNIQUE INDEX `Rarity_code_key`(`code`),
    INDEX `Rarity_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- SeedData: canonical rarity options (idempotent — production DBs that
-- already hold products are populated on `prisma migrate deploy`).
INSERT IGNORE INTO `Rarity` (`id`, `name`, `code`, `description`, `isActive`, `createdAt`, `updatedAt`) VALUES
    ('rarity-sar', 'Special Art Rare', 'SAR', 'Special Art Rare', true, NOW(3), NOW(3)),
    ('rarity-sir', 'Special Illustration Rare', 'SIR', 'Special Illustration Rare', true, NOW(3), NOW(3)),
    ('rarity-hr', 'Hyper Rare', 'HR', 'Hyper Rare', true, NOW(3), NOW(3)),
    ('rarity-ur', 'Ultra Rare', 'UR', 'Ultra Rare', true, NOW(3), NOW(3)),
    ('rarity-ar', 'Art Rare', 'AR', 'Art Rare', true, NOW(3), NOW(3)),
    ('rarity-ir', 'Illustration Rare', 'IR', 'Illustration Rare', true, NOW(3), NOW(3)),
    ('rarity-sr', 'Super Rare', 'SR', 'Super Rare', true, NOW(3), NOW(3)),
    ('rarity-rr', 'Double Rare', 'RR', 'Double Rare', true, NOW(3), NOW(3)),
    ('rarity-r', 'Rare', 'R', 'Rare', true, NOW(3), NOW(3)),
    ('rarity-u', 'Uncommon', 'U', 'Uncommon', true, NOW(3), NOW(3)),
    ('rarity-c', 'Common', 'C', 'Common', true, NOW(3), NOW(3));
