-- =====================================================================
-- Dynamic Product Attribute Filtering + Minimal Category Tree
-- =====================================================================
-- DDL (Prisma-generated):
--   * Set.code — short expansion code (e.g. "S12a", "SVI") so
--     `?set=S12a` filters by code without touching category trees.
--   * Product.rarity index + composite indexes for the common
--     multi-attribute filter pattern (?category&language&rarity):
--       (categoryId, language, rarity) and (categoryId, cardSet).
--
-- DML (hand-written, idempotent):
--   * Collapse the category tree to the two canonical merchandising
--     buckets "Sealed Products" (slug: sealed-products) and
--     "Single Cards" (slug: single-cards). Language/rarity/set are
--     product attributes, NEVER categories.
--   * The canonical rows are UPSERTed by slug so this is safe on any
--     environment (fresh DB or existing dev/prod data).
--   * Legacy game categories (pokemon, yu-gi-oh, magic-the-gathering)
--     hold no products in this store's data; they are deactivated (not
--     deleted) so nothing is destroyed and admin can reactivate later.
-- =====================================================================

-- AlterTable
ALTER TABLE `Set` ADD COLUMN `code` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `Product_rarity_idx` ON `Product`(`rarity`);

-- CreateIndex
CREATE INDEX `Product_categoryId_language_rarity_idx` ON `Product`(`categoryId`, `language`, `rarity`);

-- CreateIndex
CREATE INDEX `Product_categoryId_cardSet_idx` ON `Product`(`categoryId`, `cardSet`);

-- CreateIndex
CREATE INDEX `Set_code_idx` ON `Set`(`code`);

-- ---------------- DML: minimal category tree ----------------

-- Seed short expansion codes for the known demo sets (WHERE guards make
-- this re-runnable). New sets get their code from the admin UI / API.
UPDATE `Set` SET `code` = 'SWSH04' WHERE `slug` = 'vivid-voltage' AND (`code` IS NULL OR `code` = '');
UPDATE `Set` SET `code` = 'SWSH05' WHERE `slug` = 'battle-styles' AND (`code` IS NULL OR `code` = '');
UPDATE `Set` SET `code` = 'LOB'    WHERE `slug` = 'legend-of-blue-eyes' AND (`code` IS NULL OR `code` = '');
UPDATE `Set` SET `code` = 'MH2'    WHERE `slug` = 'modern-horizons-2' AND (`code` IS NULL OR `code` = '');

-- 1. Ensure the two canonical categories exist (INSERT IGNORE on the
--    unique slug keys — no-op when the rows already exist).
INSERT IGNORE INTO `Category` (`id`, `name`, `slug`, `description`, `imageUrl`, `isActive`, `createdAt`, `updatedAt`)
VALUES
  (REPLACE(UUID(), '-', ''), 'Sealed Products', 'sealed-products', 'Sealed booster boxes, ETBs and special collections', NULL, 1, NOW(3), NOW(3)),
  (REPLACE(UUID(), '-', ''), 'Single Cards', 'single-cards', 'Authenticated singles and chase cards', NULL, 1, NOW(3), NOW(3));

-- 2. Re-point products from the legacy binary slugs (box/card) onto the
--    canonical rows. Works whether the legacy rows were renamed or the
--    canonical rows were freshly inserted above.
UPDATE `Product` p
JOIN `Category` old ON p.`categoryId` = old.`id` AND old.`slug` IN ('box', 'card')
JOIN `Category` canonical ON canonical.`slug` = 'sealed-products'
SET p.`categoryId` = canonical.`id`
WHERE old.`slug` = 'box';

UPDATE `Product` p
JOIN `Category` old ON p.`categoryId` = old.`id` AND old.`slug` IN ('box', 'card')
JOIN `Category` canonical ON canonical.`slug` = 'single-cards'
SET p.`categoryId` = canonical.`id`
WHERE old.`slug` = 'card';

-- 3. Deactivate the legacy game categories (pokemon / yu-gi-oh /
--    magic-the-gathering) so the public storefront tree stays minimal.
--    They are deactivated, not deleted — admin can reactivate later.
--    Categories that still hold products are left active so nothing
--    disappears from the catalog.
UPDATE `Category`
SET `isActive` = 0, `updatedAt` = NOW(3)
WHERE `slug` IN ('pokemon', 'yu-gi-oh', 'magic-the-gathering')
  AND `id` NOT IN (SELECT `categoryId` FROM `Product` WHERE `categoryId` IS NOT NULL);

-- 4. Remove the now-empty legacy binary rows (box/card). The NOT IN
--    subquery guarantees no product is orphaned; safe to re-run.
UPDATE `Category`
SET `isActive` = 0, `updatedAt` = NOW(3)
WHERE `slug` IN ('box', 'card')
  AND `id` NOT IN (SELECT `categoryId` FROM `Product` WHERE `categoryId` IS NOT NULL);

DELETE FROM `Category`
WHERE `slug` IN ('box', 'card')
  AND `id` NOT IN (SELECT `categoryId` FROM `Product` WHERE `categoryId` IS NOT NULL);

-- 5. Stale category markers: the legacy schema stored `rarity='BOX'` on
--    sealed products to classify them. Now that rarity is a genuine TCG
--    attribute, clear that marker on anything under the Sealed Products
--    bucket so the rarity facet never shows a bogus "BOX" value.
UPDATE `Product` p
JOIN `Category` c ON p.`categoryId` = c.`id` AND c.`slug` = 'sealed-products'
SET p.`rarity` = NULL
WHERE p.`rarity` = 'BOX';
