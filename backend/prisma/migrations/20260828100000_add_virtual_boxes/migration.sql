-- CreateTable
CREATE TABLE "VirtualBoxPool" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "productId" TEXT,
    "cardId" TEXT,
    "rarity" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VirtualBoxPool_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VirtualBoxPool_boxId_idx" ON "VirtualBoxPool"("boxId");

-- CreateIndex
CREATE INDEX "VirtualBoxPool_productId_idx" ON "VirtualBoxPool"("productId");

-- CreateIndex
CREATE INDEX "VirtualBoxPool_cardId_idx" ON "VirtualBoxPool"("cardId");

-- AddForeignKey
ALTER TABLE "VirtualBoxPool" ADD CONSTRAINT "VirtualBoxPool_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "VirtualBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualBoxPool" ADD CONSTRAINT "VirtualBoxPool_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualBoxPool" ADD CONSTRAINT "VirtualBoxPool_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;

