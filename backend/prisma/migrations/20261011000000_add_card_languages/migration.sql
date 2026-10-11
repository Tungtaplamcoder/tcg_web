-- Dynamic product-language catalogue ("Ngôn ngữ").
--
-- Administered from Catalog Settings and bound to the inventory product modal's
-- "Ngôn ngữ (Language)" dropdown and the "Tất cả ngôn ngữ" filter. Stores ONLY
-- the full canonical language name (e.g. "English", "Japanese") — `code` /
-- `description` are intentionally absent, matching the single-field Rarity /
-- SealedCategory / CardConditionOption catalogues.

-- CreateTable
CREATE TABLE `card_languages` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `card_languages_name_key`(`name`),
    INDEX `card_languages_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- SeedData: the canonical full language names (idempotent) so the modal and
-- filter have options out of the box.
INSERT IGNORE INTO `card_languages` (`id`, `name`, `isActive`, `createdAt`, `updatedAt`) VALUES
    ('lang-english', 'English', true, NOW(3), NOW(3)),
    ('lang-japanese', 'Japanese', true, NOW(3), NOW(3)),
    ('lang-chinese', 'Chinese', true, NOW(3), NOW(3)),
    ('lang-korean', 'Korean', true, NOW(3), NOW(3)),
    ('lang-vietnamese', 'Vietnamese', true, NOW(3), NOW(3));

-- DataMigration: standardize existing Product.language short codes (JP, ENG,
-- CN, KR, …) to the full canonical names above. Product.language is a free
-- string, so this only rewrites legacy codes and leaves custom names intact.
UPDATE `Product` SET `language` = 'English'    WHERE UPPER(`language`) IN ('ENG', 'EN', 'ENGLISH');
UPDATE `Product` SET `language` = 'Japanese'   WHERE UPPER(`language`) IN ('JP', 'JPN', 'JA', 'JAPANESE');
UPDATE `Product` SET `language` = 'Chinese'    WHERE UPPER(`language`) IN ('CN', 'CHN', 'ZH', 'CHT', 'CHS', 'CHINESE');
UPDATE `Product` SET `language` = 'Korean'     WHERE UPPER(`language`) IN ('KR', 'KOR', 'KO', 'KOREAN');
UPDATE `Product` SET `language` = 'Vietnamese' WHERE UPPER(`language`) IN ('VIE', 'VN', 'VI', 'VIETNAMESE');
