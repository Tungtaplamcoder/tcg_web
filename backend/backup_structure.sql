-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `avatarUrl` VARCHAR(191) NULL,
    `role` ENUM('CUSTOMER', 'ADMIN', 'MODERATOR', 'STAFF') NOT NULL DEFAULT 'CUSTOMER',
    `status` ENUM('ACTIVE', 'BANNED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `canManageInventory` BOOLEAN NOT NULL DEFAULT false,
    `canManagePosts` BOOLEAN NOT NULL DEFAULT false,
    `balance` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Post` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `excerpt` VARCHAR(191) NULL,
    `thumbnailUrl` VARCHAR(191) NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Post_authorId_idx`(`authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(512) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,
    `replacedByToken` VARCHAR(512) NULL,
    `createdByIp` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RefreshToken_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `used` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_token_key`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `parentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Category_name_key`(`name`),
    UNIQUE INDEX `Category_slug_key`(`slug`),
    INDEX `Category_parentId_idx`(`parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Set` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `releaseDate` DATETIME(3) NULL,
    `description` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Set_slug_key`(`slug`),
    INDEX `Set_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `shortName` VARCHAR(191) NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `cardNumber` VARCHAR(191) NULL,
    `rarity` VARCHAR(191) NULL,
    `language` VARCHAR(191) NULL,
    `cardSet` VARCHAR(191) NULL,
    `artist` VARCHAR(191) NULL,
    `tcgplayerId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `images` JSON NOT NULL,
    `backImage` VARCHAR(191) NULL,
    `attributes` JSON NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'DRAFT', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Product_slug_key`(`slug`),
    INDEX `Product_categoryId_idx`(`categoryId`),
    INDEX `Product_status_idx`(`status`),
    INDEX `Product_slug_idx`(`slug`),
    INDEX `Product_language_idx`(`language`),
    INDEX `Product_cardSet_idx`(`cardSet`),
    INDEX `Product_rarity_idx`(`rarity`),
    INDEX `Product_artist_idx`(`artist`),
    INDEX `Product_categoryId_language_rarity_idx`(`categoryId`, `language`, `rarity`),
    INDEX `Product_categoryId_cardSet_idx`(`categoryId`, `cardSet`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProductVariant` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `condition` ENUM('MINT', 'NEAR_MINT', 'LIGHTLY_PLAYED', 'MODERATELY_PLAYED', 'HEAVILY_PLAYED', 'EXCELLENT', 'GOOD', 'POOR') NOT NULL DEFAULT 'NEAR_MINT',
    `variant` VARCHAR(191) NOT NULL DEFAULT 'Normal',
    `price` DECIMAL(10, 2) NOT NULL,
    `stockQuantity` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE', 'DRAFT', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ProductVariant_productId_idx`(`productId`),
    INDEX `ProductVariant_condition_idx`(`condition`),
    INDEX `ProductVariant_variant_idx`(`variant`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Card` (
    `id` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `condition` ENUM('MINT', 'NEAR_MINT', 'LIGHTLY_PLAYED', 'MODERATELY_PLAYED', 'HEAVILY_PLAYED', 'EXCELLENT', 'GOOD', 'POOR') NOT NULL DEFAULT 'NEAR_MINT',
    `status` ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'INACTIVE') NOT NULL DEFAULT 'AVAILABLE',
    `purchasePrice` DECIMAL(10, 2) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Card_sku_key`(`sku`),
    INDEX `Card_productId_idx`(`productId`),
    INDEX `Card_status_idx`(`status`),
    INDEX `Card_sku_idx`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `orderCode` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'CANCELLED', 'PACKAGING', 'SHIPPING', 'DELIVERED') NOT NULL DEFAULT 'PENDING',
    `totalAmount` DECIMAL(10, 2) NOT NULL,
    `shippingFee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `grandTotal` DECIMAL(10, 2) NOT NULL,
    `voucherCode` VARCHAR(191) NULL,
    `shippingAddress` JSON NOT NULL,
    `trackingNumber` VARCHAR(191) NULL,
    `paymentMethod` ENUM('SEPAy') NOT NULL DEFAULT 'SEPAy',
    `paymentStatus` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `expiresAt` DATETIME(3) NOT NULL,
    `paidAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Order_orderCode_key`(`orderCode`),
    INDEX `Order_userId_idx`(`userId`),
    INDEX `Order_status_idx`(`status`),
    INDEX `Order_orderCode_idx`(`orderCode`),
    INDEX `Order_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `variantId` VARCHAR(191) NULL,
    `cardId` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `totalPrice` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderItem_orderId_idx`(`orderId`),
    INDEX `OrderItem_productId_idx`(`productId`),
    INDEX `OrderItem_variantId_idx`(`variantId`),
    INDEX `OrderItem_cardId_idx`(`cardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `paymentMethod` ENUM('SEPAy') NOT NULL DEFAULT 'SEPAy',
    `amount` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
    `sepayOrderCode` VARCHAR(191) NULL,
    `sepayTransactionId` VARCHAR(191) NULL,
    `paymentUrl` VARCHAR(191) NULL,
    `qrCodeUrl` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Payment_orderId_idx`(`orderId`),
    INDEX `Payment_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentLog` (
    `id` VARCHAR(191) NOT NULL,
    `sepayTransactionId` VARCHAR(191) NULL,
    `orderId` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `rawPayload` JSON NOT NULL,
    `amount` DECIMAL(10, 2) NULL,
    `content` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'COMPLETED', 'MISMATCH', 'SIGNATURE_MISMATCH', 'INVALID_PAYLOAD', 'AMOUNT_MISMATCH', 'DUPLICATE', 'ERROR') NOT NULL DEFAULT 'PENDING',
    `errorMessage` VARCHAR(191) NULL,
    `processedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PaymentLog_sepayTransactionId_key`(`sepayTransactionId`),
    INDEX `PaymentLog_orderId_idx`(`orderId`),
    INDEX `PaymentLog_sepayTransactionId_idx`(`sepayTransactionId`),
    INDEX `PaymentLog_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderStatusHistory` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `oldStatus` ENUM('PENDING', 'CANCELLED', 'PACKAGING', 'SHIPPING', 'DELIVERED') NULL,
    `newStatus` ENUM('PENDING', 'CANCELLED', 'PACKAGING', 'SHIPPING', 'DELIVERED') NOT NULL,
    `note` VARCHAR(191) NULL,
    `changedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderStatusHistory_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Voucher` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `discountType` ENUM('PERCENT', 'FIXED') NOT NULL DEFAULT 'PERCENT',
    `discountValue` DECIMAL(10, 2) NOT NULL,
    `maxDiscountAmount` DECIMAL(10, 2) NULL,
    `minOrderAmount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `totalQuantity` INTEGER NULL,
    `usedQuantity` INTEGER NOT NULL DEFAULT 0,
    `limitPerUser` INTEGER NOT NULL DEFAULT 1,
    `startAt` DATETIME(3) NULL,
    `endAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `scope` ENUM('ALL', 'CATEGORY', 'PRODUCT') NOT NULL DEFAULT 'ALL',
    `scopeIds` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Voucher_code_key`(`code`),
    INDEX `Voucher_isActive_idx`(`isActive`),
    INDEX `Voucher_endAt_idx`(`endAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserVoucher` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `voucherId` VARCHAR(191) NOT NULL,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `claimedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserVoucher_userId_idx`(`userId`),
    INDEX `UserVoucher_voucherId_idx`(`voucherId`),
    UNIQUE INDEX `UserVoucher_userId_voucherId_key`(`userId`, `voucherId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppSetting` (
    `key` VARCHAR(191) NOT NULL,
    `value` VARCHAR(512) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AppSetting_key_idx`(`key`),
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GachaCard` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NULL,
    `rarity` ENUM('COMMON', 'RARE', 'EPIC', 'LEGENDARY') NOT NULL,
    `setCode` VARCHAR(191) NULL,
    `dropRate` DOUBLE NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GachaCard_slug_key`(`slug`),
    INDEX `GachaCard_rarity_idx`(`rarity`),
    INDEX `GachaCard_setCode_idx`(`setCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VirtualBox` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `imageUrl` VARCHAR(191) NULL,
    `gradient` VARCHAR(191) NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('ACTIVE', 'DRAFT', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VirtualBox_slug_key`(`slug`),
    INDEX `VirtualBox_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VirtualBoxDropRate` (
    `id` VARCHAR(191) NOT NULL,
    `boxId` VARCHAR(191) NOT NULL,
    `rarity` ENUM('COMMON', 'RARE', 'EPIC', 'LEGENDARY') NOT NULL,
    `rate` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VirtualBoxDropRate_boxId_idx`(`boxId`),
    UNIQUE INDEX `VirtualBoxDropRate_boxId_rarity_key`(`boxId`, `rarity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VirtualBoxPoolItem` (
    `id` VARCHAR(191) NOT NULL,
    `boxId` VARCHAR(191) NOT NULL,
    `gachaCardId` VARCHAR(191) NOT NULL,
    `rarity` ENUM('COMMON', 'RARE', 'EPIC', 'LEGENDARY') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `VirtualBoxPoolItem_boxId_rarity_idx`(`boxId`, `rarity`),
    INDEX `VirtualBoxPoolItem_gachaCardId_idx`(`gachaCardId`),
    UNIQUE INDEX `VirtualBoxPoolItem_boxId_gachaCardId_key`(`boxId`, `gachaCardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserCard` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `gachaCardId` VARCHAR(191) NOT NULL,
    `rarity` ENUM('COMMON', 'RARE', 'EPIC', 'LEGENDARY') NOT NULL,
    `source` ENUM('GACHA', 'PURCHASE', 'PROMOTION') NOT NULL DEFAULT 'GACHA',
    `openingId` VARCHAR(191) NULL,
    `obtainedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserCard_openingId_key`(`openingId`),
    INDEX `UserCard_userId_idx`(`userId`),
    INDEX `UserCard_gachaCardId_idx`(`gachaCardId`),
    INDEX `UserCard_rarity_idx`(`rarity`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VirtualBoxOpening` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `boxId` VARCHAR(191) NOT NULL,
    `userCardId` VARCHAR(191) NULL,
    `rarity` ENUM('COMMON', 'RARE', 'EPIC', 'LEGENDARY') NOT NULL,
    `pricePaid` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `VirtualBoxOpening_userCardId_key`(`userCardId`),
    INDEX `VirtualBoxOpening_userId_idx`(`userId`),
    INDEX `VirtualBoxOpening_boxId_idx`(`boxId`),
    INDEX `VirtualBoxOpening_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_ProductSets` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_ProductSets_AB_unique`(`A`, `B`),
    INDEX `_ProductSets_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Post` ADD CONSTRAINT `Post_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Product` ADD CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ProductVariant` ADD CONSTRAINT `ProductVariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Card` ADD CONSTRAINT `Card_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_voucherCode_fkey` FOREIGN KEY (`voucherCode`) REFERENCES `Voucher`(`code`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentLog` ADD CONSTRAINT `PaymentLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentLog` ADD CONSTRAINT `PaymentLog_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderStatusHistory` ADD CONSTRAINT `OrderStatusHistory_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserVoucher` ADD CONSTRAINT `UserVoucher_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserVoucher` ADD CONSTRAINT `UserVoucher_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VirtualBoxDropRate` ADD CONSTRAINT `VirtualBoxDropRate_boxId_fkey` FOREIGN KEY (`boxId`) REFERENCES `VirtualBox`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VirtualBoxPoolItem` ADD CONSTRAINT `VirtualBoxPoolItem_boxId_fkey` FOREIGN KEY (`boxId`) REFERENCES `VirtualBox`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VirtualBoxPoolItem` ADD CONSTRAINT `VirtualBoxPoolItem_gachaCardId_fkey` FOREIGN KEY (`gachaCardId`) REFERENCES `GachaCard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCard` ADD CONSTRAINT `UserCard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCard` ADD CONSTRAINT `UserCard_gachaCardId_fkey` FOREIGN KEY (`gachaCardId`) REFERENCES `GachaCard`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VirtualBoxOpening` ADD CONSTRAINT `VirtualBoxOpening_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VirtualBoxOpening` ADD CONSTRAINT `VirtualBoxOpening_boxId_fkey` FOREIGN KEY (`boxId`) REFERENCES `VirtualBox`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ProductSets` ADD CONSTRAINT `_ProductSets_A_fkey` FOREIGN KEY (`A`) REFERENCES `Product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_ProductSets` ADD CONSTRAINT `_ProductSets_B_fkey` FOREIGN KEY (`B`) REFERENCES `Set`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

