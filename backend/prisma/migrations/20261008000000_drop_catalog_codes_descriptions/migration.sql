-- Simplify the dynamic catalogues ("Độ hiếm" / Sealed Products /
-- "Tình trạng thẻ") down to a single `name` field.
--
-- `code` and `description` were redundant: the UI only ever exposes a name,
-- and `code` (derived from the name) added a second identifier to keep in
-- sync. Product.rarity / ProductVariant.condition / the sealed category slug
-- now all key off the name, so the columns are dropped permanently.
--
-- MySQL/MariaDB automatically drops a single-column index when its column is
-- removed, so no explicit DROP INDEX is required.

ALTER TABLE `Rarity` DROP COLUMN `code`, DROP COLUMN `description`;
ALTER TABLE `SealedCategory` DROP COLUMN `code`, DROP COLUMN `description`;
ALTER TABLE `card_conditions` DROP COLUMN `code`, DROP COLUMN `description`;
