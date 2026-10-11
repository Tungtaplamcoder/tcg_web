-- Dynamic card-condition catalogue ("Tình trạng thẻ").
--
-- Administered from Catalog Settings (Admin only) and bound to the inventory
-- product modal's "TÌNH TRẠNG" variant dropdown for BOTH Admin and Staff.
-- Mirrors the dynamic `Rarity` / `SealedCategory` catalogues so card
-- conditions (Near Mint, PSA 10, Ungraded, …) are DB-driven instead of the
-- hardcoded CardCondition enum.

-- CreateTable
CREATE TABLE `card_conditions` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `card_conditions_name_key`(`name`),
    UNIQUE INDEX `card_conditions_code_key`(`code`),
    INDEX `card_conditions_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ProductVariant.condition becomes a free string so dynamically quick-added
-- conditions can be stored (legacy enum values are preserved as-is).
ALTER TABLE `ProductVariant` MODIFY `condition` VARCHAR(64) NOT NULL DEFAULT 'NEAR_MINT';

-- SeedData: canonical conditions matching the legacy enum codes so existing
-- single-card variants keep resolving to a labelled option (idempotent).
INSERT IGNORE INTO `card_conditions` (`id`, `name`, `code`, `description`, `isActive`, `createdAt`, `updatedAt`) VALUES
    ('cond-mint', 'Mint', 'MINT', 'Mint', true, NOW(3), NOW(3)),
    ('cond-near-mint', 'Near Mint', 'NEAR_MINT', 'Near Mint', true, NOW(3), NOW(3)),
    ('cond-lightly-played', 'Lightly Played', 'LIGHTLY_PLAYED', 'Lightly Played', true, NOW(3), NOW(3)),
    ('cond-moderately-played', 'Moderately Played', 'MODERATELY_PLAYED', 'Moderately Played', true, NOW(3), NOW(3)),
    ('cond-heavily-played', 'Heavily Played', 'HEAVILY_PLAYED', 'Heavily Played', true, NOW(3), NOW(3)),
    ('cond-damaged', 'Damaged', 'DAMAGED', 'Damaged', true, NOW(3), NOW(3)),
    ('cond-excellent', 'Excellent', 'EXCELLENT', 'Excellent', true, NOW(3), NOW(3)),
    ('cond-good', 'Good', 'GOOD', 'Good', true, NOW(3), NOW(3)),
    ('cond-poor', 'Poor', 'POOR', 'Poor', true, NOW(3), NOW(3));
