-- ============================================================================
-- repair_schema_drift.sql — Aligns a LIVE DB imported from the OLD
-- `migration.sql` with the CURRENT `backend/prisma/schema.prisma`
-- (equivalent to `backend/full_schema.sql`).
--
-- Symptom fixed: HTTP 500 (P2022/P2021) on /products, /virtual-boxes,
-- /chat/rooms, /admin/orders, gacha opening and checkout.
--
-- HOW TO RUN: cPanel > phpMyAdmin > select the app database > SQL (or
-- Import) > paste/choose this file > Go. MariaDB 10.4+ (uses IF [NOT]
-- EXISTS guards — the whole script is safe to re-run).
--
-- !! BACKUP FIRST (phpMyAdmin > Export > Quick > SQL) !!
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 1. `Set` — schema.prisma uses imageUrl, live DB has logoUrl
-- ============================================================================
ALTER TABLE `Set` ADD COLUMN IF NOT EXISTS `imageUrl` VARCHAR(191) NULL;
SET @do := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Set' AND COLUMN_NAME = 'logoUrl');
SET @stmt := IF(@do > 0, 'UPDATE `Set` SET `imageUrl` = `logoUrl` WHERE `imageUrl` IS NULL AND `logoUrl` IS NOT NULL', 'SELECT ''skip''');
PREPARE g FROM @stmt; EXECUTE g; DEALLOCATE PREPARE g;
ALTER TABLE `Set` DROP COLUMN IF EXISTS `logoUrl`;

-- ============================================================================
-- 2. `Product` — add new-shape columns (legacy price/stock kept until §4)
-- ============================================================================
UPDATE `Product` SET `status` = 'INACTIVE' WHERE `status` = 'ARCHIVED';

ALTER TABLE `Product`
  ADD COLUMN IF NOT EXISTS `shortName`   VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `images`     JSON NULL,
  ADD COLUMN IF NOT EXISTS `backImage`  VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `tcgplayerId` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `version`   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `deletedAt`  DATETIME(3) NULL;

-- images: seed from legacy imageUrl, then force NOT NULL
SET @do := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Product' AND COLUMN_NAME = 'imageUrl');
SET @stmt := IF(@do > 0, 'UPDATE `Product` SET `images` = JSON_ARRAY(`imageUrl`) WHERE `images` IS NULL AND `imageUrl` IS NOT NULL', 'SELECT ''skip''');
PREPARE g FROM @stmt; EXECUTE g; DEALLOCATE PREPARE g;
UPDATE `Product` SET `images` = '[]' WHERE `images` IS NULL;
ALTER TABLE `Product` MODIFY `images` JSON NOT NULL;

-- rarity: free-text VARCHAR (was a 5-value enum), status: new 4-value enum
ALTER TABLE `Product` MODIFY `rarity` VARCHAR(191) NULL;
ALTER TABLE `Product` MODIFY `status` ENUM('ACTIVE','INACTIVE','DRAFT','DELETED') NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE `Product` ADD INDEX IF NOT EXISTS `Product_slug_idx`(`slug`);

-- ============================================================================
-- 3. `ProductVariant` — new condition/variant/price/status columns.
--    THIS is the /products 500 fix (variant select references condition).
-- ============================================================================
ALTER TABLE `ProductVariant`
  ADD COLUMN IF NOT EXISTS `condition` ENUM('MINT','NEAR_MINT','LIGHTLY_PLAYED','MODERATELY_PLAYED','HEAVILY_PLAYED','EXCELLENT','GOOD','POOR') NOT NULL DEFAULT 'NEAR_MINT',
  ADD COLUMN IF NOT EXISTS `variant`  VARCHAR(191) NOT NULL DEFAULT 'Normal',
  ADD COLUMN IF NOT EXISTS `price`    DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS `status`   ENUM('ACTIVE','INACTIVE','DRAFT','DELETED') NOT NULL DEFAULT 'ACTIVE';

-- Backfill price from legacy Product.price (+ priceModifier) while they exist
SET @do := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductVariant' AND COLUMN_NAME = 'priceModifier');
SET @stmt := IF(@do > 0, 'UPDATE `ProductVariant` pv JOIN `Product` p ON p.`id` = pv.`productId` SET pv.`price` = COALESCE(p.`price`, 0) + COALESCE(pv.`priceModifier`, 0) WHERE pv.`price` IS NULL', 'SELECT ''skip''');
PREPARE g FROM @stmt; EXECUTE g; DEALLOCATE PREPARE g;
UPDATE `ProductVariant` SET `price` = 0 WHERE `price` IS NULL;
ALTER TABLE `ProductVariant` MODIFY `price` DECIMAL(10,2) NOT NULL;

-- Backfill variant name from legacy `name`
SET @do := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ProductVariant' AND COLUMN_NAME = 'name');
SET @stmt := IF(@do > 0, 'UPDATE `ProductVariant` SET `variant` = `name` WHERE `name` IS NOT NULL AND `name` <> ''''', 'SELECT ''skip''');
PREPARE g FROM @stmt; EXECUTE g; DEALLOCATE PREPARE g;

-- Seed one default variant per legacy product (price lived on Product before)
SET @do := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Product' AND COLUMN_NAME = 'price');
SET @stmt := IF(@do > 0,
  'INSERT INTO `ProductVariant` (`id`,`productId`,`name`,`sku`,`condition`,`variant`,`price`,`stockQuantity`,`status`,`createdAt`,`updatedAt`)
   SELECT UUID(), p.`id`, ''Normal'', CONCAT(''legacy-'', p.`id`), ''NEAR_MINT'', ''Normal'', COALESCE(p.`price`,0), COALESCE(p.`stockQuantity`,0),
          CASE WHEN p.`status` = ''ACTIVE'' THEN ''ACTIVE'' ELSE ''INACTIVE'' END, NOW(3), NOW(3)
   FROM `Product` p
   WHERE NOT EXISTS (SELECT 1 FROM `ProductVariant` pv WHERE pv.`productId` = p.`id`)',
  'SELECT ''skip''');
PREPARE g FROM @stmt; EXECUTE g; DEALLOCATE PREPARE g;

ALTER TABLE `ProductVariant`
  DROP INDEX  IF EXISTS `ProductVariant_sku_key`,
  DROP COLUMN IF EXISTS `sku`,
  DROP COLUMN IF EXISTS `name`,
  DROP COLUMN IF EXISTS `priceModifier`,
  ADD INDEX IF NOT EXISTS `ProductVariant_condition_idx`(`condition`),
  ADD INDEX IF NOT EXISTS `ProductVariant_variant_idx`(`variant`);

-- ============================================================================
-- 4. `Product` — drop legacy columns (after §3 finished reading them)
-- ============================================================================
ALTER TABLE `Product`
  DROP COLUMN IF EXISTS `longDescription`,
  DROP COLUMN IF EXISTS `type`,
  DROP COLUMN IF EXISTS `grade`,
  DROP COLUMN IF EXISTS `price`,
  DROP COLUMN IF EXISTS `marketPrice`,
  DROP COLUMN IF EXISTS `stockQuantity`,
  DROP COLUMN IF EXISTS `releaseYear`,
  DROP COLUMN IF EXISTS `imageUrl`,
  DROP COLUMN IF EXISTS `isFeatured`,
  DROP COLUMN IF EXISTS `soldCount`,
  DROP COLUMN IF EXISTS `viewCount`;

-- ============================================================================
-- 5. `Card` — missing purchasePrice / notes + indexes
-- ============================================================================
ALTER TABLE `Card`
  ADD COLUMN IF NOT EXISTS `purchasePrice` DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS `notes` VARCHAR(191) NULL,
  ADD INDEX IF NOT EXISTS `Card_status_idx`(`status`),
  ADD INDEX IF NOT EXISTS `Card_sku_idx`(`sku`);

-- ============================================================================
-- 6. `Order` — add missing indexes (columns already match)
-- ============================================================================
ALTER TABLE `Order`
  ADD INDEX IF NOT EXISTS `Order_orderCode_idx`(`orderCode`),
  ADD INDEX IF NOT EXISTS `Order_expiresAt_idx`(`expiresAt`);

-- ============================================================================
-- 7. `OrderItem` — drop productName (NOT NULL, but app never writes it
--    -> every checkout INSERT failed) + add variantId index
-- ============================================================================
ALTER TABLE `OrderItem`
  DROP COLUMN IF EXISTS `productName`,
  ADD INDEX IF NOT EXISTS `OrderItem_variantId_idx`(`variantId`);

-- ============================================================================
-- 8. `Payment` — rename gateway columns to the SePay shape the client uses
-- ============================================================================
ALTER TABLE `Payment`
  ADD COLUMN IF NOT EXISTS `paymentMethod`      ENUM('SEPAy') NOT NULL DEFAULT 'SEPAy',
  ADD COLUMN IF NOT EXISTS `sepayOrderCode`    VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `sepayTransactionId` VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `paymentUrl`        VARCHAR(191) NULL,
  ADD COLUMN IF NOT EXISTS `qrCodeUrl`         VARCHAR(191) NULL;
SET @do := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Payment' AND COLUMN_NAME = 'method');
SET @stmt := IF(@do > 0, 'UPDATE `Payment` SET `paymentMethod` = `method` WHERE `method` IN (''SEPAy'')', 'SELECT ''skip''');
PREPARE g FROM @stmt; EXECUTE g; DEALLOCATE PREPARE g;
ALTER TABLE `Payment`
  DROP INDEX  IF EXISTS `Payment_gatewayTransactionId_idx`,
  DROP COLUMN IF EXISTS `method`,
  DROP COLUMN IF EXISTS `gatewayTransactionId`,
  ADD INDEX IF NOT EXISTS `Payment_status_idx`(`status`);

-- ============================================================================
-- 9. `PaymentLog` — sepayTransactionId must be UNIQUE (the webhook service
--    upserts with findUnique on it; non-unique column = Prisma error)
-- ============================================================================
UPDATE `PaymentLog` pl
LEFT JOIN (SELECT MIN(`id`) AS keepId, `sepayTransactionId` FROM `PaymentLog` WHERE `sepayTransactionId` IS NOT NULL GROUP BY `sepayTransactionId`) k
  ON pl.`id` = k.keepId
SET pl.`sepayTransactionId` = NULL
WHERE pl.`sepayTransactionId` IS NOT NULL AND k.keepId IS NULL;
ALTER TABLE `PaymentLog` ADD UNIQUE INDEX IF NOT EXISTS `PaymentLog_sepayTransactionId_key`(`sepayTransactionId`);

-- ============================================================================
-- 10. `OrderStatusHistory` — changedBy -> changedByUserId
-- ============================================================================
ALTER TABLE `OrderStatusHistory` ADD COLUMN IF NOT EXISTS `changedByUserId` VARCHAR(191) NULL;
SET @do := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'OrderStatusHistory' AND COLUMN_NAME = 'changedBy');
SET @stmt := IF(@do > 0, 'UPDATE `OrderStatusHistory` SET `changedByUserId` = `changedBy` WHERE `changedByUserId` IS NULL AND `changedBy` IS NOT NULL', 'SELECT ''skip''');
PREPARE g FROM @stmt; EXECUTE g; DEALLOCATE PREPARE g;
ALTER TABLE `OrderStatusHistory` DROP COLUMN IF EXISTS `changedBy`;

-- ============================================================================
-- 11. `ChatRoom` — THE /chat/rooms FIX:
--     missing `subject`, wrong status enum (ACTIVE vs OPEN), lastMessageAt,
--     orderId must be UNIQUE
-- ============================================================================
UPDATE `ChatRoom` SET `status` = 'OPEN' WHERE `status` = 'ACTIVE';
ALTER TABLE `ChatRoom` ADD COLUMN IF NOT EXISTS `subject` VARCHAR(191) NOT NULL DEFAULT 'General Support';
UPDATE `ChatRoom` SET `subject` = CONCAT('Đơn hàng #', LEFT(`orderId`, 8)) WHERE `orderId` IS NOT NULL;
UPDATE `ChatRoom` cr
LEFT JOIN (SELECT MIN(`id`) AS keepId, `orderId` FROM `ChatRoom` WHERE `orderId` IS NOT NULL GROUP BY `orderId`) k
  ON cr.`id` = k.keepId
SET cr.`orderId` = NULL
WHERE cr.`orderId` IS NOT NULL AND k.keepId IS NULL;
ALTER TABLE `ChatRoom` DROP FOREIGN KEY IF EXISTS `ChatRoom_orderId_fkey`;
ALTER TABLE `ChatRoom` DROP INDEX IF EXISTS `ChatRoom_orderId_idx`;
ALTER TABLE `ChatRoom`
  DROP COLUMN IF EXISTS `lastMessageAt`,
  MODIFY `status` ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  ADD UNIQUE INDEX IF NOT EXISTS `ChatRoom_orderId_key`(`orderId`),
  ADD INDEX IF NOT EXISTS `ChatRoom_status_idx`(`status`);

-- ============================================================================
-- 12. `ChatParticipant` — lastReadAt is nullable in schema.prisma
-- ============================================================================
ALTER TABLE `ChatParticipant` MODIFY `lastReadAt` DATETIME(3) NULL;

-- ============================================================================
-- 13. `ChatMessage` — missing type/readAt; widen content to match the
--     2000-char limit the API accepts
-- ============================================================================
ALTER TABLE `ChatMessage`
  ADD COLUMN IF NOT EXISTS `type`   ENUM('TEXT','SYSTEM') NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS `readAt` DATETIME(3) NULL,
  MODIFY `content` VARCHAR(2000) NOT NULL,
  DROP INDEX IF EXISTS `ChatMessage_isRead_idx`;

-- ============================================================================
-- 14. `UserVoucher` — usageCount/claimedAt replace usedAt/orderId
-- ============================================================================
ALTER TABLE `UserVoucher`
  ADD COLUMN IF NOT EXISTS `usageCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `claimedAt` DATETIME(3) NULL;
SET @do := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'UserVoucher' AND COLUMN_NAME = 'usedAt');
SET @stmt := IF(@do > 0, 'UPDATE `UserVoucher` SET `claimedAt` = COALESCE(`usedAt`, `createdAt`) WHERE `claimedAt` IS NULL', 'SELECT ''skip''');
PREPARE g FROM @stmt; EXECUTE g; DEALLOCATE PREPARE g;
UPDATE `UserVoucher` SET `claimedAt` = `createdAt` WHERE `claimedAt` IS NULL;
ALTER TABLE `UserVoucher` MODIFY `claimedAt` DATETIME(3) NOT NULL;
ALTER TABLE `UserVoucher`
  DROP COLUMN IF EXISTS `usedAt`,
  DROP COLUMN IF EXISTS `orderId`,
  ADD INDEX IF NOT EXISTS `UserVoucher_userId_idx`(`userId`);

-- ============================================================================
-- 15. `Voucher` — missing indexes
-- ============================================================================
ALTER TABLE `Voucher`
  ADD INDEX IF NOT EXISTS `Voucher_isActive_idx`(`isActive`),
  ADD INDEX IF NOT EXISTS `Voucher_endAt_idx`(`endAt`);

-- ============================================================================
-- 16. `GachaCard` — missing index
-- ============================================================================
ALTER TABLE `GachaCard` ADD INDEX IF NOT EXISTS `GachaCard_setCode_idx`(`setCode`);

-- ============================================================================
-- 17. `VirtualBox` — THE /virtual-boxes FIX: missing imageUrl; make
--     description/gradient nullable like schema.prisma
-- ============================================================================
ALTER TABLE `VirtualBox`
  ADD COLUMN IF NOT EXISTS `imageUrl` VARCHAR(191) NULL,
  MODIFY `description` VARCHAR(191) NULL,
  MODIFY `gradient`   VARCHAR(191) NULL,
  ADD INDEX IF NOT EXISTS `VirtualBox_status_idx`(`status`);

-- ============================================================================
-- 18. `VirtualBoxDropRate` — missing updatedAt
-- ============================================================================
ALTER TABLE `VirtualBoxDropRate`
  ADD COLUMN IF NOT EXISTS `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- ============================================================================
-- 19. `VirtualBoxPoolItem` — (boxId, gachaCardId) must be UNIQUE
-- ============================================================================
DELETE vpi1 FROM `VirtualBoxPoolItem` vpi1
JOIN `VirtualBoxPoolItem` vpi2
  ON  vpi1.`boxId` = vpi2.`boxId`
  AND vpi1.`gachaCardId` = vpi2.`gachaCardId`
  AND vpi1.`id` > vpi2.`id`;
ALTER TABLE `VirtualBoxPoolItem`
  DROP INDEX IF EXISTS `VirtualBoxPoolItem_boxId_idx`,
  ADD UNIQUE INDEX IF NOT EXISTS `VirtualBoxPoolItem_boxId_gachaCardId_key`(`boxId`, `gachaCardId`),
  ADD INDEX IF NOT EXISTS `VirtualBoxPoolItem_boxId_rarity_idx`(`boxId`, `rarity`);

-- ============================================================================
-- 20. `UserCard` — gacha collection re-shape: one row PER obtained card
--     (the old UNIQUE(userId, gachaCardId) made every 2nd opening of the
--     same card fail with P2002). NOTE: if you already have quantity > 1
--     rows you want to keep, duplicate them BEFORE dropping `quantity`.
-- ============================================================================
ALTER TABLE `UserCard`
  ADD COLUMN IF NOT EXISTS `rarity` ENUM('COMMON','RARE','EPIC','LEGENDARY') NULL,
  ADD COLUMN IF NOT EXISTS `source` ENUM('GACHA','PURCHASE','PROMOTION') NOT NULL DEFAULT 'GACHA',
  ADD COLUMN IF NOT EXISTS `openingId` VARCHAR(191) NULL;
UPDATE `UserCard` uc JOIN `GachaCard` gc ON gc.`id` = uc.`gachaCardId`
  SET uc.`rarity` = gc.`rarity` WHERE uc.`rarity` IS NULL;
UPDATE `UserCard` SET `rarity` = 'COMMON' WHERE `rarity` IS NULL;
ALTER TABLE `UserCard` MODIFY `rarity` ENUM('COMMON','RARE','EPIC','LEGENDARY') NOT NULL;
ALTER TABLE `UserCard`
  DROP INDEX IF EXISTS `UserCard_userId_gachaCardId_key`,
  DROP COLUMN IF EXISTS `quantity`,
  ADD UNIQUE INDEX IF NOT EXISTS `UserCard_openingId_key`(`openingId`),
  ADD INDEX IF NOT EXISTS `UserCard_userId_idx`(`userId`),
  ADD INDEX IF NOT EXISTS `UserCard_rarity_idx`(`rarity`);

-- ============================================================================
-- 21. `VirtualBoxOpening` — drop legacy gachaCardId (NOT NULL blocked the
--     new INSERT shape that only sends userCardId)
-- ============================================================================
ALTER TABLE `VirtualBoxOpening` DROP COLUMN IF EXISTS `gachaCardId`;

-- ============================================================================
-- 22. Re-add relations that never existed on the old import (guarded)
-- ============================================================================
SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'ChatRoom' AND CONSTRAINT_NAME = 'ChatRoom_orderId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @stmt := IF(@fk = 0, 'ALTER TABLE `ChatRoom` ADD CONSTRAINT `ChatRoom_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT ''skip''');
PREPARE g FROM @stmt; EXECUTE g; DEALLOCATE PREPARE g;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'ChatMessage' AND CONSTRAINT_NAME = 'ChatMessage_roomId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY');
SET @stmt := IF(@fk = 0, 'ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `ChatRoom`(`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT ''skip''');
PREPARE g FROM @stmt; EXECUTE g; DEALLOCATE PREPARE g;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- VERIFY (each must return 1 row)
-- ============================================================================
-- SHOW COLUMNS FROM `ProductVariant` LIKE 'condition';
-- SHOW COLUMNS FROM `VirtualBox`      LIKE 'imageUrl';
-- SHOW COLUMNS FROM `ChatRoom`       LIKE 'subject';
-- SHOW COLUMNS FROM `Payment`        LIKE 'sepayOrderCode';
-- SHOW INDEX FROM `UserCard` WHERE Key_name = 'UserCard_openingId_key';
