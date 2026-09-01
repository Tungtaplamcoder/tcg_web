-- Gacha decoupling: dedicated GachaCard pool, fully separated from the
-- retail Shop Inventory (Product/Card). Existing pools are backfilled so
-- live boxes keep working, then legacy Product references are dropped.

-- 1. Create the dedicated GachaCard table
CREATE TABLE "GachaCard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "imageUrl" TEXT,
    "rarity" "GachaRarity" NOT NULL,
    "setCode" TEXT,
    "dropRate" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GachaCard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GachaCard_slug_key" ON "GachaCard"("slug");
CREATE INDEX "GachaCard_rarity_idx" ON "GachaCard"("rarity");
CREATE INDEX "GachaCard_setCode_idx" ON "GachaCard"("setCode");

-- 2. Backfill: seed one GachaCard per distinct Product used by gacha pools
--    (VirtualBoxPoolItem). Rarity comes from the pool item so the gacha
--    tiers stay exactly as configured; image/name are copied from the
--    product as a starting point admins can refine later.
INSERT INTO "GachaCard" ("id", "name", "slug", "imageUrl", "rarity", "setCode", "dropRate", "updatedAt")
SELECT
    gen_random_uuid(),
    p."name",
    CONCAT('gacha-', p."slug"),
    COALESCE(p."images"[1], NULL),
    COALESCE(
        (SELECT i."rarity" FROM "VirtualBoxPoolItem" i WHERE i."productId" = p."id" ORDER BY i."createdAt" DESC LIMIT 1),
        'COMMON'
    ),
    p."cardNumber",
    1,
    CURRENT_TIMESTAMP
FROM "Product" p
WHERE p."id" IN (SELECT DISTINCT "productId" FROM "VirtualBoxPoolItem")
ON CONFLICT ("slug") DO NOTHING;

-- 3. VirtualBoxPoolItem: switch productId → gachaCardId
ALTER TABLE "VirtualBoxPoolItem" DROP CONSTRAINT "VirtualBoxPoolItem_productId_fkey";
DROP INDEX "VirtualBoxPoolItem_boxId_productId_key";

ALTER TABLE "VirtualBoxPoolItem" ADD COLUMN "gachaCardId" TEXT;
UPDATE "VirtualBoxPoolItem" i
SET "gachaCardId" = gc."id"
FROM "GachaCard" gc
WHERE gc."slug" = CONCAT('gacha-', (SELECT p."slug" FROM "Product" p WHERE p."id" = i."productId"));

-- Any pool item that failed to backfill (orphan productId) is removed;
-- a box with no remaining items is an empty pool, not a broken schema.
DELETE FROM "VirtualBoxPoolItem" WHERE "gachaCardId" IS NULL;

ALTER TABLE "VirtualBoxPoolItem" ALTER COLUMN "gachaCardId" SET NOT NULL;
ALTER TABLE "VirtualBoxPoolItem" DROP COLUMN "productId";
CREATE UNIQUE INDEX "VirtualBoxPoolItem_boxId_gachaCardId_key" ON "VirtualBoxPoolItem"("boxId", "gachaCardId");
CREATE INDEX "VirtualBoxPoolItem_gachaCardId_idx" ON "VirtualBoxPoolItem"("gachaCardId");
ALTER TABLE "VirtualBoxPoolItem" ADD CONSTRAINT "VirtualBoxPoolItem_gachaCardId_fkey" FOREIGN KEY ("gachaCardId") REFERENCES "GachaCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. UserCard: switch productId → gachaCardId (existing pulls keep their
--    card identity; gacha pulls were never purchasable shop inventory).
ALTER TABLE "UserCard" DROP CONSTRAINT "UserCard_productId_fkey";
ALTER TABLE "UserCard" ADD COLUMN "gachaCardId" TEXT;
UPDATE "UserCard" uc
SET "gachaCardId" = gc."id"
FROM "GachaCard" gc
WHERE gc."slug" = CONCAT('gacha-', (SELECT p."slug" FROM "Product" p WHERE p."id" = uc."productId"));

DELETE FROM "UserCard" WHERE "gachaCardId" IS NULL;
ALTER TABLE "UserCard" ALTER COLUMN "gachaCardId" SET NOT NULL;
ALTER TABLE "UserCard" DROP COLUMN "productId";
CREATE INDEX "UserCard_gachaCardId_idx" ON "UserCard"("gachaCardId");
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_gachaCardId_fkey" FOREIGN KEY ("gachaCardId") REFERENCES "GachaCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Drop the legacy VirtualBoxPool table (admin UI + opener both use
--    poolItems; this table was a stale mirror of Product/Card refs).
DROP TABLE "VirtualBoxPool";
