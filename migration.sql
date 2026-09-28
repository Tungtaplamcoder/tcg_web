/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.8.6-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: tcg_db
-- ------------------------------------------------------
-- Server version	11.8.6-MariaDB-0+deb13u1 from Debian

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `AppSetting`
--

DROP TABLE IF EXISTS `AppSetting`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `AppSetting` (
  `key` varchar(191) NOT NULL,
  `value` varchar(512) NOT NULL,
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`key`),
  KEY `AppSetting_key_idx` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `AppSetting`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `AppSetting` WRITE;
/*!40000 ALTER TABLE `AppSetting` DISABLE KEYS */;
INSERT INTO `AppSetting` VALUES
('site:site_favicon_url','','2026-09-15 17:28:26.622'),
('site:site_title','TCG Store','2026-09-15 17:28:26.622'),
('site:support_chat_url','https://m.me/1251937284677510','2026-09-15 17:28:26.622');
/*!40000 ALTER TABLE `AppSetting` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `Card`
--

DROP TABLE IF EXISTS `Card`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `Card` (
  `id` varchar(191) NOT NULL,
  `sku` varchar(191) NOT NULL,
  `productId` varchar(191) NOT NULL,
  `condition` enum('MINT','NEAR_MINT','LIGHTLY_PLAYED','MODERATELY_PLAYED','HEAVILY_PLAYED','EXCELLENT','GOOD','POOR') NOT NULL DEFAULT 'NEAR_MINT',
  `status` enum('AVAILABLE','RESERVED','SOLD','INACTIVE') NOT NULL DEFAULT 'AVAILABLE',
  `purchasePrice` decimal(10,2) DEFAULT NULL,
  `notes` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Card_sku_key` (`sku`),
  KEY `Card_productId_idx` (`productId`),
  KEY `Card_status_idx` (`status`),
  KEY `Card_sku_idx` (`sku`),
  CONSTRAINT `Card_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Card`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `Card` WRITE;
/*!40000 ALTER TABLE `Card` DISABLE KEYS */;
/*!40000 ALTER TABLE `Card` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `Category`
--

DROP TABLE IF EXISTS `Category`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `Category` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `slug` varchar(191) NOT NULL,
  `description` varchar(191) DEFAULT NULL,
  `imageUrl` varchar(191) DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `parentId` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Category_name_key` (`name`),
  UNIQUE KEY `Category_slug_key` (`slug`),
  KEY `Category_parentId_idx` (`parentId`),
  CONSTRAINT `Category_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Category` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Category`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `Category` WRITE;
/*!40000 ALTER TABLE `Category` DISABLE KEYS */;
INSERT INTO `Category` VALUES
('2fcd819bb0f011f187d4c3c8a0c80ad6','Sealed Products','sealed-products','Sealed booster boxes, ETBs and special collections',NULL,1,'2026-09-15 17:28:26.583','2026-09-15 17:28:26.583'),
('2fcd8264b0f011f187d4c3c8a0c80ad6','Single Cards','single-cards','Authenticated singles and chase cards',NULL,1,'2026-09-15 17:28:26.583','2026-09-15 17:28:26.583');
/*!40000 ALTER TABLE `Category` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `GachaCard`
--

DROP TABLE IF EXISTS `GachaCard`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `GachaCard` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `slug` varchar(191) NOT NULL,
  `imageUrl` varchar(191) DEFAULT NULL,
  `rarity` enum('COMMON','RARE','EPIC','LEGENDARY') NOT NULL,
  `setCode` varchar(191) DEFAULT NULL,
  `dropRate` double NOT NULL DEFAULT 1,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `GachaCard_slug_key` (`slug`),
  KEY `GachaCard_rarity_idx` (`rarity`),
  KEY `GachaCard_setCode_idx` (`setCode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `GachaCard`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `GachaCard` WRITE;
/*!40000 ALTER TABLE `GachaCard` DISABLE KEYS */;
/*!40000 ALTER TABLE `GachaCard` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `Order`
--

DROP TABLE IF EXISTS `Order`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `Order` (
  `id` varchar(191) NOT NULL,
  `orderCode` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `status` enum('PENDING','CANCELLED','PACKAGING','SHIPPING','DELIVERED') NOT NULL DEFAULT 'PENDING',
  `totalAmount` decimal(10,2) NOT NULL,
  `shippingFee` decimal(10,2) NOT NULL DEFAULT 0.00,
  `discountAmount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `grandTotal` decimal(10,2) NOT NULL,
  `voucherCode` varchar(191) DEFAULT NULL,
  `shippingAddress` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`shippingAddress`)),
  `trackingNumber` varchar(191) DEFAULT NULL,
  `paymentMethod` enum('SEPAy') NOT NULL DEFAULT 'SEPAy',
  `paymentStatus` enum('PENDING','COMPLETED','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  `expiresAt` datetime(3) NOT NULL,
  `paidAt` datetime(3) DEFAULT NULL,
  `cancelledAt` datetime(3) DEFAULT NULL,
  `completedAt` datetime(3) DEFAULT NULL,
  `version` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Order_orderCode_key` (`orderCode`),
  KEY `Order_userId_idx` (`userId`),
  KEY `Order_status_idx` (`status`),
  KEY `Order_orderCode_idx` (`orderCode`),
  KEY `Order_expiresAt_idx` (`expiresAt`),
  KEY `Order_voucherCode_fkey` (`voucherCode`),
  CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `Order_voucherCode_fkey` FOREIGN KEY (`voucherCode`) REFERENCES `Voucher` (`code`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Order`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `Order` WRITE;
/*!40000 ALTER TABLE `Order` DISABLE KEYS */;
/*!40000 ALTER TABLE `Order` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `OrderItem`
--

DROP TABLE IF EXISTS `OrderItem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `OrderItem` (
  `id` varchar(191) NOT NULL,
  `orderId` varchar(191) NOT NULL,
  `productId` varchar(191) DEFAULT NULL,
  `variantId` varchar(191) DEFAULT NULL,
  `cardId` varchar(191) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unitPrice` decimal(10,2) NOT NULL,
  `totalPrice` decimal(10,2) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `OrderItem_orderId_idx` (`orderId`),
  KEY `OrderItem_productId_idx` (`productId`),
  KEY `OrderItem_variantId_idx` (`variantId`),
  KEY `OrderItem_cardId_idx` (`cardId`),
  CONSTRAINT `OrderItem_cardId_fkey` FOREIGN KEY (`cardId`) REFERENCES `Card` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `OrderItem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `OrderItem_variantId_fkey` FOREIGN KEY (`variantId`) REFERENCES `ProductVariant` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `OrderItem`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `OrderItem` WRITE;
/*!40000 ALTER TABLE `OrderItem` DISABLE KEYS */;
/*!40000 ALTER TABLE `OrderItem` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `OrderStatusHistory`
--

DROP TABLE IF EXISTS `OrderStatusHistory`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `OrderStatusHistory` (
  `id` varchar(191) NOT NULL,
  `orderId` varchar(191) NOT NULL,
  `oldStatus` enum('PENDING','CANCELLED','PACKAGING','SHIPPING','DELIVERED') DEFAULT NULL,
  `newStatus` enum('PENDING','CANCELLED','PACKAGING','SHIPPING','DELIVERED') NOT NULL,
  `note` varchar(191) DEFAULT NULL,
  `changedByUserId` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `OrderStatusHistory_orderId_idx` (`orderId`),
  CONSTRAINT `OrderStatusHistory_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `OrderStatusHistory`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `OrderStatusHistory` WRITE;
/*!40000 ALTER TABLE `OrderStatusHistory` DISABLE KEYS */;
/*!40000 ALTER TABLE `OrderStatusHistory` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `PasswordResetToken`
--

DROP TABLE IF EXISTS `PasswordResetToken`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `PasswordResetToken` (
  `id` varchar(191) NOT NULL,
  `token` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `used` tinyint(1) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `PasswordResetToken_token_key` (`token`),
  KEY `PasswordResetToken_userId_fkey` (`userId`),
  CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PasswordResetToken`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `PasswordResetToken` WRITE;
/*!40000 ALTER TABLE `PasswordResetToken` DISABLE KEYS */;
/*!40000 ALTER TABLE `PasswordResetToken` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `Payment`
--

DROP TABLE IF EXISTS `Payment`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `Payment` (
  `id` varchar(191) NOT NULL,
  `orderId` varchar(191) NOT NULL,
  `paymentMethod` enum('SEPAy') NOT NULL DEFAULT 'SEPAy',
  `amount` decimal(10,2) NOT NULL,
  `status` enum('PENDING','COMPLETED','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  `sepayOrderCode` varchar(191) DEFAULT NULL,
  `sepayTransactionId` varchar(191) DEFAULT NULL,
  `paymentUrl` varchar(191) DEFAULT NULL,
  `qrCodeUrl` varchar(191) DEFAULT NULL,
  `paidAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Payment_orderId_idx` (`orderId`),
  KEY `Payment_status_idx` (`status`),
  CONSTRAINT `Payment_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Payment`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `Payment` WRITE;
/*!40000 ALTER TABLE `Payment` DISABLE KEYS */;
/*!40000 ALTER TABLE `Payment` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `PaymentLog`
--

DROP TABLE IF EXISTS `PaymentLog`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `PaymentLog` (
  `id` varchar(191) NOT NULL,
  `sepayTransactionId` varchar(191) DEFAULT NULL,
  `orderId` varchar(191) DEFAULT NULL,
  `paymentId` varchar(191) DEFAULT NULL,
  `rawPayload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`rawPayload`)),
  `amount` decimal(10,2) DEFAULT NULL,
  `content` varchar(191) DEFAULT NULL,
  `status` enum('PENDING','COMPLETED','MISMATCH','SIGNATURE_MISMATCH','INVALID_PAYLOAD','AMOUNT_MISMATCH','DUPLICATE','ERROR') NOT NULL DEFAULT 'PENDING',
  `errorMessage` varchar(191) DEFAULT NULL,
  `processedAt` datetime(3) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `PaymentLog_sepayTransactionId_key` (`sepayTransactionId`),
  KEY `PaymentLog_orderId_idx` (`orderId`),
  KEY `PaymentLog_sepayTransactionId_idx` (`sepayTransactionId`),
  KEY `PaymentLog_status_idx` (`status`),
  KEY `PaymentLog_paymentId_fkey` (`paymentId`),
  CONSTRAINT `PaymentLog_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `PaymentLog_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `Payment` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `PaymentLog`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `PaymentLog` WRITE;
/*!40000 ALTER TABLE `PaymentLog` DISABLE KEYS */;
/*!40000 ALTER TABLE `PaymentLog` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `Post`
--

DROP TABLE IF EXISTS `Post`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `Post` (
  `id` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL,
  `content` varchar(191) NOT NULL,
  `excerpt` varchar(191) DEFAULT NULL,
  `thumbnailUrl` varchar(191) DEFAULT NULL,
  `authorId` varchar(191) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `Post_authorId_idx` (`authorId`),
  CONSTRAINT `Post_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Post`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `Post` WRITE;
/*!40000 ALTER TABLE `Post` DISABLE KEYS */;
/*!40000 ALTER TABLE `Post` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `Product`
--

DROP TABLE IF EXISTS `Product`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `Product` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `shortName` varchar(191) DEFAULT NULL,
  `slug` varchar(191) NOT NULL,
  `description` varchar(191) DEFAULT NULL,
  `cardNumber` varchar(191) DEFAULT NULL,
  `rarity` varchar(191) DEFAULT NULL,
  `artist` varchar(191) DEFAULT NULL,
  `tcgplayerId` varchar(191) DEFAULT NULL,
  `categoryId` varchar(191) DEFAULT NULL,
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`images`)),
  `backImage` varchar(191) DEFAULT NULL,
  `attributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attributes`)),
  `status` enum('ACTIVE','INACTIVE','DRAFT','DELETED') NOT NULL DEFAULT 'ACTIVE',
  `version` int(11) NOT NULL DEFAULT 0,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `deletedAt` datetime(3) DEFAULT NULL,
  `cardSet` varchar(191) DEFAULT NULL,
  `language` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Product_slug_key` (`slug`),
  KEY `Product_categoryId_idx` (`categoryId`),
  KEY `Product_status_idx` (`status`),
  KEY `Product_slug_idx` (`slug`),
  KEY `Product_language_idx` (`language`),
  KEY `Product_cardSet_idx` (`cardSet`),
  KEY `Product_rarity_idx` (`rarity`),
  KEY `Product_categoryId_language_rarity_idx` (`categoryId`,`language`,`rarity`),
  KEY `Product_categoryId_cardSet_idx` (`categoryId`,`cardSet`),
  CONSTRAINT `Product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Product`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `Product` WRITE;
/*!40000 ALTER TABLE `Product` DISABLE KEYS */;
/*!40000 ALTER TABLE `Product` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `ProductVariant`
--

DROP TABLE IF EXISTS `ProductVariant`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ProductVariant` (
  `id` varchar(191) NOT NULL,
  `productId` varchar(191) NOT NULL,
  `condition` enum('MINT','NEAR_MINT','LIGHTLY_PLAYED','MODERATELY_PLAYED','HEAVILY_PLAYED','EXCELLENT','GOOD','POOR') NOT NULL DEFAULT 'NEAR_MINT',
  `variant` varchar(191) NOT NULL DEFAULT 'Normal',
  `price` decimal(10,2) NOT NULL,
  `stockQuantity` int(11) NOT NULL DEFAULT 0,
  `status` enum('ACTIVE','INACTIVE','DRAFT','DELETED') NOT NULL DEFAULT 'ACTIVE',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `ProductVariant_productId_idx` (`productId`),
  KEY `ProductVariant_condition_idx` (`condition`),
  KEY `ProductVariant_variant_idx` (`variant`),
  CONSTRAINT `ProductVariant_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `Product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ProductVariant`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `ProductVariant` WRITE;
/*!40000 ALTER TABLE `ProductVariant` DISABLE KEYS */;
/*!40000 ALTER TABLE `ProductVariant` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `RefreshToken`
--

DROP TABLE IF EXISTS `RefreshToken`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `RefreshToken` (
  `id` varchar(191) NOT NULL,
  `token` varchar(512) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `expiresAt` datetime(3) NOT NULL,
  `revoked` tinyint(1) NOT NULL DEFAULT 0,
  `replacedByToken` varchar(512) DEFAULT NULL,
  `createdByIp` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `RefreshToken_token_key` (`token`),
  KEY `RefreshToken_userId_fkey` (`userId`),
  CONSTRAINT `RefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `RefreshToken`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `RefreshToken` WRITE;
/*!40000 ALTER TABLE `RefreshToken` DISABLE KEYS */;
INSERT INTO `RefreshToken` VALUES
('03036d70-4752-4bb1-b8a2-b2712189a76c','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImU2ZGUwYmQ0LWRhZWMtNDE2ZC1hMWMxLTE3N2MwNTk3YjQxOCIsImlhdCI6MTc4OTU5MzYzNSwiZXhwIjoxNzkyMTg1NjM1fQ.-kL2Cr-TIIQo-AbGA-rKx6Cah8SKaW2Cczw73JEUmKk','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 21:20:35.017',0,NULL,'::1','2026-09-16 21:20:35.018'),
('03612825-ac26-4892-b375-25f82ef862cd','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6Ijk5Y2RjODIwLWQ4YTctNGMwMy1hNzdhLWE1Y2E4Y2EyZGUyOSIsImlhdCI6MTc4OTUzNDM3OSwiZXhwIjoxNzkyMTI2Mzc5fQ.RTCQwS3Z44sLt1uf8BInsyyIu8jrcLBwiy7gw8e8UDU','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 04:52:59.193',0,NULL,'::1','2026-09-16 04:52:59.194'),
('0e0e5411-3f73-4cb6-8618-69a66ff65271','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjdkNjkxZjFjLWE0OTAtNDE5Zi1iYWZjLWU2MzQ0NjY0NGM4NiIsImlhdCI6MTc4OTUyNzA1MCwiZXhwIjoxNzkyMTE5MDUwfQ.RZcGFTg2oCerIhKyic1CKjQaHrBRdrJVKIs6u1nxYTU','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 02:50:50.839',0,NULL,'::1','2026-09-16 02:50:50.840'),
('1067a718-eaf8-45a4-9cca-41015d65932b','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImFmYzFkYmI1LTM2OTUtNDQ5Mi1iN2YzLThkZTA0MGRjODhmMSIsImlhdCI6MTc4OTUyNjgzOCwiZXhwIjoxNzkyMTE4ODM4fQ.bxAU7A99kU0Mxn8_k3OmOmsXCSwt6NBFfjgOOrDyEFY','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 02:47:18.908',0,NULL,'::1','2026-09-16 02:47:18.908'),
('12bb4420-3168-43c8-988b-331c9df11709','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjM4YjY1MWIxLThjNGEtNDA3Mi05MjY3LTZjOWRlNTczNjkyMyIsImlhdCI6MTc4OTUyNzc1MSwiZXhwIjoxNzkyMTE5NzUxfQ.87WyJdzpQ1EEgsxiM-L_OddMZeUWwri4pE7N1-nBNFg','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 03:02:31.399',0,NULL,'::1','2026-09-16 03:02:31.400'),
('1e11025e-84f6-4fac-af4f-8d096efc6b6e','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImZhNmJmY2U3LWIxOWYtNGZjYy04MWNjLTJiNWRmZmU2ZDM5ZSIsImlhdCI6MTc4OTUzNjkwNiwiZXhwIjoxNzkyMTI4OTA2fQ.lWVHU6QcNG-ktD5y7G18r5Y8scMsDPdUdYZojd_Od4E','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 05:35:06.109',0,NULL,'::1','2026-09-16 05:35:06.110'),
('2359250d-ae13-4f11-9049-84b26fbb3a13','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImNmZGIxYWRkLTUyMzItNDFhYS05NTBiLTI4NTllZTUwOWI2ZCIsImlhdCI6MTc4OTU5MzY2MywiZXhwIjoxNzkyMTg1NjYzfQ.ED5Z0G_hs0IcE3yIboQmkhOSAUDG0CUDY9b_uLwDyIg','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 21:21:03.237',0,NULL,'::1','2026-09-16 21:21:03.238'),
('2a8177e4-e846-4005-99c0-bca70ef3b5ef','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjU4Mzc0NGIxLWI5MWYtNGVjYS1iZWYzLTQ2N2RlNDE0OTg0YyIsImlhdCI6MTc4OTUzNDM0NSwiZXhwIjoxNzkyMTI2MzQ1fQ.IxiMblSqa-vtok8lvRH09uPl4eNtK8OulrFsdCeVXXM','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 04:52:25.240',0,NULL,'::1','2026-09-16 04:52:25.241'),
('3a0e7d24-2d87-43b0-89c0-a0aad9b77e3b','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjEzNWM4YmE2LTliMDQtNGE5My1iMWY1LThhMTg3MTZkM2NhZSIsImlhdCI6MTc4OTUyNjg2MCwiZXhwIjoxNzkyMTE4ODYwfQ.ZYWNeyp2KLofOj1Iap8QJ7L0iJPQCWxr__0JTexXWaI','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 02:47:40.689',0,NULL,'::1','2026-09-16 02:47:40.690'),
('3fae0b63-3bbb-4a20-be3f-f0550d12c0e5','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjVlNjEyM2FkLTBkMTktNGZjOC1hMzMxLTcwMzhhNjE2NzIyMyIsImlhdCI6MTc4OTUzNjkxMiwiZXhwIjoxNzkyMTI4OTEyfQ.NBsccIcvUNG37bqmPBUzZFsEWPF9mn9DzzCkJpZOH40','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 05:35:12.342',0,NULL,'::1','2026-09-16 05:35:12.343'),
('41b1f3d3-6525-4fe3-8ce5-2dfab1c8e86b','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImVkOWYwMjE0LTYyNGEtNDMwMS1iNTk3LTBmYzk5YmM3ZGVlZiIsImlhdCI6MTc4OTUyNzc2NSwiZXhwIjoxNzkyMTE5NzY1fQ.rzMxDInY8kgTgoH7qeZp_Aex-ErmwNOtJhhADYpqrGI','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 03:02:45.787',0,NULL,'::1','2026-09-16 03:02:45.788'),
('4dcfd773-1969-4280-a0bd-cdfb21235467','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6Ijc2OGJiNGIzLTRmZDQtNDJmNi1hN2U3LTE5OTdhMTA5MzliNSIsImlhdCI6MTc4OTU5MzY3NSwiZXhwIjoxNzkyMTg1Njc1fQ.il4GN31QW1YL2edkH5gvAz42ZISpInDstvpA85I8B9Y','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 21:21:15.182',0,NULL,'::1','2026-09-16 21:21:15.183'),
('50006229-577a-4b74-8a11-1a14ce2a66c5','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjlmZDI0NjUwLTY2MWYtNDZhYS04NzhkLTA1OWNhNjE1N2EyZCIsImlhdCI6MTc4OTUyNzcwMiwiZXhwIjoxNzkyMTE5NzAyfQ.ez664IX7dRoK2Bxezx5gxtU8wXSZpH11gPL_v5eF4mI','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 03:01:42.707',0,NULL,'::1','2026-09-16 03:01:42.708'),
('50ce3eed-5871-49b6-b9ce-d8f52bb98a34','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjFlZWMxNDkwLTNjNmEtNDc5My1iNmMzLTUwODgwZWNlZjZmOCIsImlhdCI6MTc4OTUzNDM3MiwiZXhwIjoxNzkyMTI2MzcyfQ.Pzbb1Mr9LQfNvM-UZD8moOQNetekJ0K2tetpLYIERhk','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 04:52:52.558',0,NULL,'::1','2026-09-16 04:52:52.559'),
('523f5645-7f2d-4d96-86e9-301be23a0cda','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImZjNDQyMTU2LWJiODMtNDg5NS1iYzNlLTIwY2I0N2I0OWY5ZSIsImlhdCI6MTc4OTUzNDMwNiwiZXhwIjoxNzkyMTI2MzA2fQ.UlYNKfq8wmVR92yEY4FWOIi6pI4SqiVZuTTSaUaqmvg','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 04:51:46.697',0,NULL,'::1','2026-09-16 04:51:46.698'),
('52e442f6-629f-4642-a54c-bdc711d5b995','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImZkOGRhMjI0LTA0YWItNDYxMy04NTM3LTE1ZjkyYjAyMWZhZSIsImlhdCI6MTc4OTU5MzY0MSwiZXhwIjoxNzkyMTg1NjQxfQ.rD9knyNYjqOWy0U7r211RFCuDXyF7ieNvnWnXnx7pRY','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 21:20:41.393',0,NULL,'::1','2026-09-16 21:20:41.394'),
('59fe85f7-6de5-4c26-b307-f1b34e60505e','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjMwYzNhMDRhLTY1MTEtNGQwNS04OGE2LTljZDVmOTYyMzFlYyIsImlhdCI6MTc4OTUyNjk2MCwiZXhwIjoxNzkyMTE4OTYwfQ.EWJ_9IRm7shsvrIjjebJepIf8IhQ46hG3W4uV_hZcvk','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 02:49:20.460',0,NULL,'::1','2026-09-16 02:49:20.461'),
('5d9ca7de-52e2-4678-b76d-3cb4f6b406b0','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6Ijk5ZDA4ZTZjLTg0ZjgtNDA3NS1hNjg5LTRmZDMzODIyNTkyNSIsImlhdCI6MTc4OTUzNDMzNiwiZXhwIjoxNzkyMTI2MzM2fQ.GJ5NOujVeFRu6fZYvLDv3d4AfIoMdcF2V3oEK_mg_Mg','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 04:52:16.509',0,NULL,'::1','2026-09-16 04:52:16.510'),
('5eb90a29-1635-46ca-bb02-3d16039c2f64','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjEzNTRkNGZiLWY2MWUtNGM2OC05NzYyLTllYjg2ZDg2YmViZSIsImlhdCI6MTc4OTUyNjg4MiwiZXhwIjoxNzkyMTE4ODgyfQ._mC2pXlcQbZufsOqHlc4Q1tI3Mhg6ckzJOwxtNRtwr4','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 02:48:02.448',0,NULL,'::1','2026-09-16 02:48:02.449'),
('66521127-5f1e-49bb-8284-9661b18bcbf7','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjY1M2JkMGEzLWY3OWYtNGJmZC04YTJmLTJhOTYyNjVjM2RmOCIsImlhdCI6MTc4OTU5MzY5NiwiZXhwIjoxNzkyMTg1Njk2fQ.xZxx7w6_QoKpMwgkF_8n6C4C_GYYJsOyqfmTXkIBj5o','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 21:21:36.317',0,NULL,'::1','2026-09-16 21:21:36.318'),
('66e071e0-8ba7-4a3a-aeaa-b3d59edf5060','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImI4ODI0NmUzLWExZmMtNGEwYi04ZDA4LTk3ZDk2NjllN2Y4MCIsImlhdCI6MTc4OTUzNjg3OCwiZXhwIjoxNzkyMTI4ODc4fQ.rU46gaytGkkVECz_MAHIzpeo-kk1FU73kyVqRAjgp-4','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 05:34:38.039',0,NULL,'::1','2026-09-16 05:34:38.040'),
('6bd65aac-e42a-4237-ac21-91055a377ae3','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjRjNDYyODA4LTkyYzUtNDRhYy1iMDczLTZhNzRlOGJhZTA1NCIsImlhdCI6MTc4OTUyNjk4MiwiZXhwIjoxNzkyMTE4OTgyfQ.dMsLeVOXyrSto-UIS4mdteGy12hUwROBOaoya0Sy10Q','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 02:49:42.819',0,NULL,'::1','2026-09-16 02:49:42.820'),
('6dff3029-5165-4d61-8859-451c50359d50','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImMyMTAwZWRlLTZkZTktNGRlMS1iMWQxLTM0MDZkMGE2ZmM1MiIsImlhdCI6MTc4OTUzNjkxNiwiZXhwIjoxNzkyMTI4OTE2fQ.SS48gvPfmfbU75ZbFRemK3ALvnv5r-OwCRgUi5vwhys','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 05:35:16.578',0,NULL,'::1','2026-09-16 05:35:16.579'),
('6f7a8199-1b15-4f50-8b9f-5f8f0820c594','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjYwZjNjOThkLThjZjUtNDc2Yi04YmY4LTU3NWI4ZGJiNmI0OSIsImlhdCI6MTc4OTUyNzY1NywiZXhwIjoxNzkyMTE5NjU3fQ.bdHLa-TsgbOYc8ePMKXoclU6vbtlZsoKoulhhIuKDu0','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 03:00:57.920',0,NULL,'::1','2026-09-16 03:00:57.921'),
('717f0dc4-065e-4919-9bd6-9e07df575493','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjRmNGE2NTQyLTZmNjEtNDFjZC05MDdhLWRkMjczYWFiMmZkYSIsImlhdCI6MTc4OTUzNjg3MSwiZXhwIjoxNzkyMTI4ODcxfQ.pc9FOCoXIYNoYYZp3QI0PEyPlNm2t4golTpCMO_azK8','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 05:34:31.893',0,NULL,'::1','2026-09-16 05:34:31.894'),
('886dee9a-e7b8-4311-bc9e-67cd6e7724b4','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6Ijc2MGUzMjUwLTcwOGUtNGY0YS1hYzhlLWZjMWEwMzUyYTM2MCIsImlhdCI6MTc4OTUyNzcxMCwiZXhwIjoxNzkyMTE5NzEwfQ.JkVvx1dYtSUYDItTeoO9LBoeO18wyr0EJBUoWcoZ7d8','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 03:01:50.110',0,NULL,'::1','2026-09-16 03:01:50.111'),
('8c4a56ef-98a9-4f84-9e27-e3c3641245a4','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjU0ZDEzNTNiLThlYzctNGRmNy1hOThjLWRlNmVlN2NkNzU1NyIsImlhdCI6MTc4OTU5MzY3OSwiZXhwIjoxNzkyMTg1Njc5fQ.QsqlQeuc-E5Dij4vgig9Q6nps1dUorTTRFj7WnhRUAk','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 21:21:19.218',0,NULL,'::1','2026-09-16 21:21:19.219'),
('8ea851aa-f40d-47ab-9798-0852f11c14f5','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImI4ODA2NDkwLTkzZTAtNDEyMS1iZWJlLTE2MjgzMzhkOGRhZCIsImlhdCI6MTc4OTU5MzY4OSwiZXhwIjoxNzkyMTg1Njg5fQ.ELe3wjazkdCfkoCglqVYs3fHBvXsgdqDML4JpfNaQu8','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 21:21:29.782',0,NULL,'::1','2026-09-16 21:21:29.783'),
('96403131-a663-4d5b-b999-8b374aecd7d9','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImIwZWNmYjZiLTk3YTgtNDA0ZC1iZGZlLTIxY2Y3MGUzNmI2ZCIsImlhdCI6MTc4OTUzNjkyMCwiZXhwIjoxNzkyMTI4OTIwfQ.uDuwwetxzjEjgAr5Mt43gitsm3Wbr27wzuobLaOv1OY','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 05:35:20.761',0,NULL,'::1','2026-09-16 05:35:20.762'),
('99240404-ca75-483b-af93-68f5c088cbad','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImE2ZGFjOTBjLTUzMDEtNDYzNS05OGMyLTk3MjIyOGViMTM5OCIsImlhdCI6MTc4OTUyNzczNSwiZXhwIjoxNzkyMTE5NzM1fQ.zB95AD-olcktIv_ewhZfvaIZH4KEzKEfxAX7MoYuNxg','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 03:02:15.637',0,NULL,'::1','2026-09-16 03:02:15.638'),
('9d6fe834-b51f-465a-aaad-9bdb2a4e9143','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImExZWZhNDc1LTIwYTYtNGI0OC1hN2Q4LWJiYTVhOTFiZDZlNSIsImlhdCI6MTc4OTU5MzY4MywiZXhwIjoxNzkyMTg1NjgzfQ.P-YVSa1OhNCkS4cQto-edmFWV1EjOXakcCG9p4B79Wg','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 21:21:23.345',0,NULL,'::1','2026-09-16 21:21:23.346'),
('a6552f51-0a77-4000-a0b2-8bc617a8ef19','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImEyYzVlMDU3LTMyYmYtNDQ1MS1iYTVhLTFkNzM1ZjAxYTNjYSIsImlhdCI6MTc4OTUyNzc0MywiZXhwIjoxNzkyMTE5NzQzfQ.5xrBxDf6KYh-Yi64DVwI7Dom963fspK4ummZQaJunRA','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 03:02:23.560',0,NULL,'::1','2026-09-16 03:02:23.561'),
('a687fd2f-d6a4-4fd6-b82f-f85613a03e05','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImE1Yzc4YjYzLWUwZDAtNDRlMy04NjVlLTUyOTkxOTE3NGM4YSIsImlhdCI6MTc4OTUzNDM2MiwiZXhwIjoxNzkyMTI2MzYyfQ.eE4l23KXc6-e0Pn6-LzZxk4UkhQO2NX2-xwDx70IvRI','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 04:52:42.206',0,NULL,'::1','2026-09-16 04:52:42.207'),
('a92cb2e4-7b73-406a-a63d-4bdda2e7b6dd','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjJhNGY3YjVkLWVhNTItNDgwNi1hZjM5LWNjYWIyZTdiYzJmMyIsImlhdCI6MTc4OTUzNDM1MSwiZXhwIjoxNzkyMTI2MzUxfQ.dYxwJ2hlOD94x6txlmo-yot5mrEKPERJqD-zHDlkr5Y','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 04:52:31.788',0,NULL,'::1','2026-09-16 04:52:31.789'),
('b0724664-e9df-426f-ac1b-a4ac1686f5a5','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImJmYjRkN2M0LTI5NzctNDQzMS1hYmUzLTUzNTcyZWRlNDY4OCIsImlhdCI6MTc4OTUzNjkzMywiZXhwIjoxNzkyMTI4OTMzfQ.k9g5iqiPlVcPfKAbVoiVI3IgGM0cpsHaAcf04BgvdAo','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 05:35:33.799',0,NULL,'::1','2026-09-16 05:35:33.799'),
('bae06591-7a30-4128-b292-130cae33ecad','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImVjZjI1ZmJjLTZkMjItNDU1Mi1hOGMyLTcyNGY1ODQ2NjNhZSIsImlhdCI6MTc4OTUzNDMyOSwiZXhwIjoxNzkyMTI2MzI5fQ.l3543BZ9aQwNFK--HiNFXL182vGlykmIfml05acAxZE','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 04:52:09.117',0,NULL,'::1','2026-09-16 04:52:09.117'),
('bc15faee-b99b-469b-bd77-d4f8439ae2e1','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjE5Y2VlZWM0LTAwMTktNDE1NC05NjYyLWQ5ZmM4ZWU3MTU5OSIsImlhdCI6MTc4OTUyNzY4MCwiZXhwIjoxNzkyMTE5NjgwfQ.VOVMW3eLn3rmR1F9DGysWMcfWH3u0vAM0g6MSLPrY6E','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 03:01:20.168',0,NULL,'::1','2026-09-16 03:01:20.169'),
('bcef4c38-77c7-41aa-be60-d84a21f96f12','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjY3ZjFlNGM1LTE2YWMtNGM1MC1hNTI2LTJjMDQ0OGZhOWJhMCIsImlhdCI6MTc4OTUzNDM2NiwiZXhwIjoxNzkyMTI2MzY2fQ.XQUJMzyyoEMdGZNBv-lIczCW0URHgMkefwtxEwr9Tms','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 04:52:46.303',0,NULL,'::1','2026-09-16 04:52:46.304'),
('bee3bfb9-810b-4938-a761-7a27a4e5c237','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjFlZjA4NTYzLWYxMmItNDQ4MS1iYzM2LTllMWY0NWRmMjk5MCIsImlhdCI6MTc4OTUyNzc1OSwiZXhwIjoxNzkyMTE5NzU5fQ.C9f61UVYS4Q-GuBkuKTD2xkxOQpwEgwXmipXXgQEYJQ','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 03:02:39.536',0,NULL,'::1','2026-09-16 03:02:39.537'),
('c7b4a766-3eda-42df-9536-0a999f60b00b','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjUwMjJhNGViLWE0NTUtNDk4MC1iOTI5LTY0NzUyNmMwMzk2MyIsImlhdCI6MTc4OTUyNzc1NSwiZXhwIjoxNzkyMTE5NzU1fQ.Py73c2EByEUCllVlUsn4b9Ci1z-eZXhqQuG_Xuvut5Y','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 03:02:35.501',0,NULL,'::1','2026-09-16 03:02:35.502'),
('ce68f671-284a-440a-95dd-1a9c2ad1e4e8','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImVjYjg1MmMxLWMyNDctNDI2My05ZWQ0LTI0Y2Y4NTY3ZTlkMCIsImlhdCI6MTc4OTUzNDI4NCwiZXhwIjoxNzkyMTI2Mjg0fQ.QemuWIcftbEBS6-Z_hg83EYj8adeaIILwnLHO7tKiHM','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 04:51:24.138',0,NULL,'::1','2026-09-16 04:51:24.139'),
('d04c2377-1282-48e2-868a-ecb303fb411a','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjhlNTc2MWUyLWI3MTItNDZhNS04YmRlLTYzYzdhYTU3ZTc0MCIsImlhdCI6MTc4OTU5MzY0NywiZXhwIjoxNzkyMTg1NjQ3fQ.C-0iQnFoQlZSCwYFXuz6XsgODteq4_Hmsb2X1Fn83wE','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 21:20:47.491',0,NULL,'::1','2026-09-16 21:20:47.492'),
('d058021b-343e-4f9b-9c00-ba445c65a3f2','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjU3YTU1ZGE0LTc5MzMtNGZhOC1hYWRmLWFkMGMxNGI1NTQ1YiIsImlhdCI6MTc4OTUyNjg4OCwiZXhwIjoxNzkyMTE4ODg4fQ.DwIgeNal38s3uWE-8KhP0C5DnVidLAh78ybcrxDDkaE','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 02:48:08.066',0,NULL,'::1','2026-09-16 02:48:08.067'),
('d0e3247d-986a-43b7-bb90-1b164cfd93ea','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjNhMjU2NDk4LTRiZGMtNGEzNy1hN2QyLTI2OTE2ZTNjOThkOSIsImlhdCI6MTc4OTUzNjg5MCwiZXhwIjoxNzkyMTI4ODkwfQ.8r4DvW_3_jlpD5kLU_tU459Gb-FDFOWrSC5kCHn0Mxo','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 05:34:50.963',0,NULL,'::1','2026-09-16 05:34:50.964'),
('d70143b3-13ea-456f-a4fb-6aeef1fa0e46','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjQ1MzUxYWY4LTNhMjUtNGYwZS1iYWM5LWEzYjdhZThlZTBjMSIsImlhdCI6MTc4OTUyNzMxMiwiZXhwIjoxNzkyMTE5MzEyfQ.l3gd39zfFDx0n4GJNkgNUqF1Et3SjXvRJAIYh1JH5CU','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 02:55:12.357',0,NULL,'::1','2026-09-16 02:55:12.358'),
('d8733f85-61f0-46d8-a098-ea2b0cf68f40','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImExZDEyMDI0LWI2N2UtNGNlOS04NzI0LTlkNzEwOTc0M2ViMCIsImlhdCI6MTc4OTUzNjkyNywiZXhwIjoxNzkyMTI4OTI3fQ.eplV1S5adxZjesUp4jEx_tbQFRhXmC7hSGVjGZPYqlw','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 05:35:27.116',0,NULL,'::1','2026-09-16 05:35:27.117'),
('d9a801f9-9fde-407b-a2bd-7a15cbac1632','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImFmNjE0YTdkLTlmMjUtNGFkNy1iYjU4LTI1NThjYTM1NTk3MyIsImlhdCI6MTc4OTUzNDM1NywiZXhwIjoxNzkyMTI2MzU3fQ.vnF4phWrJ97AeZDKJR0QXom_i6DQzAD7p2dyMSQToDY','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 04:52:37.974',0,NULL,'::1','2026-09-16 04:52:37.974'),
('dc0f2b2f-033c-47f7-b611-c12a5c72f0be','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImQ5Nzc2YjI4LWQ0YWQtNDkxYi1hYjU4LWQzOGYxNGFkZjJiYyIsImlhdCI6MTc4OTUyNzc3MiwiZXhwIjoxNzkyMTE5NzcyfQ.7m-hptGAmuRNSKk4Dc-bmbxNtcq_xfNXeXZS5QuQDrs','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 03:02:52.535',0,NULL,'::1','2026-09-16 03:02:52.536'),
('dc1963a4-ab89-405d-b46b-73c286a11974','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImFmOTcxYTFlLTFlMDYtNDE0NS1hZjQ1LTExNDgwMmJkNTEzMSIsImlhdCI6MTc4OTUzNjg5OSwiZXhwIjoxNzkyMTI4ODk5fQ.ER0qveW5YcevBIQStszTLZ8oKpjaCUCXjLGe0vbyiHs','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 05:34:59.845',0,NULL,'::1','2026-09-16 05:34:59.846'),
('e73f2ed0-e376-4dfd-8933-97e8dbff5312','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjU0ZWQ3MWFiLWNiMGMtNDc0OS1hZmQ1LTFhYWNiNDFjMzkwOSIsImlhdCI6MTc4OTUzNjg4MywiZXhwIjoxNzkyMTI4ODgzfQ.kKhfK9Suj5v1Wd8jtcnYf44htfS84eJx76Y9pa4q3QA','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 05:34:43.952',0,NULL,'::1','2026-09-16 05:34:43.953'),
('f51dfdf7-7294-4e60-afe2-95db717bb218','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6IjJjYzRkMWIwLTNmMWItNGQyZC1iYmZhLTcxODM4ZjU1ZGRkNCIsImlhdCI6MTc4OTU5MzY1NCwiZXhwIjoxNzkyMTg1NjU0fQ.KJcDA8rjUR6M1z4sCbRnGR6pe8nNSZxi6qBVd7Fy0oU','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 21:20:54.419',0,NULL,'::1','2026-09-16 21:20:54.420'),
('feb5da46-46cb-4e85-a8e5-c0a89b6113f9','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoicmVmcmVzaCIsImp0aSI6ImY1YTBjOTI0LThlY2QtNGUxYi1hZDM0LTVjOWQzMzFmNzNkMSIsImlhdCI6MTc4OTU5MzY2OSwiZXhwIjoxNzkyMTg1NjY5fQ.qHznJf0vUd7G0kAvDKyyucnq2wb4Tm-e-iS0j7yexAY','0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','2026-09-23 21:21:09.192',0,NULL,'::1','2026-09-16 21:21:09.193');
/*!40000 ALTER TABLE `RefreshToken` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `Set`
--

DROP TABLE IF EXISTS `Set`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `Set` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `slug` varchar(191) NOT NULL,
  `releaseDate` datetime(3) DEFAULT NULL,
  `description` varchar(191) DEFAULT NULL,
  `imageUrl` varchar(191) DEFAULT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  `code` varchar(191) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Set_slug_key` (`slug`),
  KEY `Set_code_idx` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Set`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `Set` WRITE;
/*!40000 ALTER TABLE `Set` DISABLE KEYS */;
/*!40000 ALTER TABLE `Set` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `User`
--

DROP TABLE IF EXISTS `User`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `User` (
  `id` varchar(191) NOT NULL,
  `email` varchar(191) DEFAULT NULL,
  `passwordHash` varchar(191) NOT NULL,
  `fullName` varchar(191) NOT NULL,
  `phone` varchar(191) NOT NULL,
  `address` varchar(191) DEFAULT NULL,
  `avatarUrl` varchar(191) DEFAULT NULL,
  `role` enum('CUSTOMER','ADMIN','MODERATOR','STAFF') NOT NULL DEFAULT 'CUSTOMER',
  `status` enum('ACTIVE','BANNED','DELETED') NOT NULL DEFAULT 'ACTIVE',
  `emailVerified` tinyint(1) NOT NULL DEFAULT 0,
  `canManageInventory` tinyint(1) NOT NULL DEFAULT 0,
  `canManagePosts` tinyint(1) NOT NULL DEFAULT 0,
  `balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `User_phone_key` (`phone`),
  UNIQUE KEY `User_email_key` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `User`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `User` WRITE;
/*!40000 ALTER TABLE `User` DISABLE KEYS */;
INSERT INTO `User` VALUES
('0d6aff4a-a42d-4eb3-8f4c-ac8439e7376e','admin@tcg.com','$2a$12$yWc9FylU/uQ6T4.HSEdKC./6XLugHdbZRO4/ICiN8pi/62OjdW31W','Admin User','84900000001','1 Admin St, Hanoi',NULL,'ADMIN','ACTIVE',1,1,1,0.00,'2026-09-15 10:30:42.791','2026-09-15 10:30:42.791'),
('c92e4954-ec89-4e6d-b7a4-43395224aa97','customer@tcg.com','$2a$12$4QKJYuSZuHhgCwT9vFEdFe.mBnuvqyLPQaBWU5.O22Pug3ssHX.8W','Customer User','84900000003','3 Customer St, Hanoi',NULL,'CUSTOMER','ACTIVE',1,0,0,100.00,'2026-09-15 10:30:42.796','2026-09-15 10:30:42.796'),
('d41e69b5-c3e3-4643-8ecc-9ce22ea4f27f','staff@tcg.com','$2a$12$mgVOCQYlwzR2Au6W4BlxmeWP/sQctRF0kx.QxYqnkh0/RAmd7WeBO','Staff User','84900000002','2 Staff St, Hanoi',NULL,'STAFF','ACTIVE',1,1,1,0.00,'2026-09-15 10:30:42.793','2026-09-15 10:30:42.793');
/*!40000 ALTER TABLE `User` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `UserCard`
--

DROP TABLE IF EXISTS `UserCard`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `UserCard` (
  `id` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `gachaCardId` varchar(191) NOT NULL,
  `rarity` enum('COMMON','RARE','EPIC','LEGENDARY') NOT NULL,
  `source` enum('GACHA','PURCHASE','PROMOTION') NOT NULL DEFAULT 'GACHA',
  `openingId` varchar(191) DEFAULT NULL,
  `obtainedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UserCard_openingId_key` (`openingId`),
  KEY `UserCard_userId_idx` (`userId`),
  KEY `UserCard_gachaCardId_idx` (`gachaCardId`),
  KEY `UserCard_rarity_idx` (`rarity`),
  CONSTRAINT `UserCard_gachaCardId_fkey` FOREIGN KEY (`gachaCardId`) REFERENCES `GachaCard` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `UserCard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `UserCard`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `UserCard` WRITE;
/*!40000 ALTER TABLE `UserCard` DISABLE KEYS */;
/*!40000 ALTER TABLE `UserCard` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `UserVoucher`
--

DROP TABLE IF EXISTS `UserVoucher`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `UserVoucher` (
  `id` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `voucherId` varchar(191) NOT NULL,
  `usageCount` int(11) NOT NULL DEFAULT 0,
  `claimedAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `UserVoucher_userId_voucherId_key` (`userId`,`voucherId`),
  KEY `UserVoucher_userId_idx` (`userId`),
  KEY `UserVoucher_voucherId_idx` (`voucherId`),
  CONSTRAINT `UserVoucher_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserVoucher_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `Voucher` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `UserVoucher`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `UserVoucher` WRITE;
/*!40000 ALTER TABLE `UserVoucher` DISABLE KEYS */;
/*!40000 ALTER TABLE `UserVoucher` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `VirtualBox`
--

DROP TABLE IF EXISTS `VirtualBox`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `VirtualBox` (
  `id` varchar(191) NOT NULL,
  `name` varchar(191) NOT NULL,
  `slug` varchar(191) NOT NULL,
  `description` varchar(191) DEFAULT NULL,
  `imageUrl` varchar(191) DEFAULT NULL,
  `gradient` varchar(191) DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `status` enum('ACTIVE','DRAFT','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `VirtualBox_slug_key` (`slug`),
  KEY `VirtualBox_status_idx` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `VirtualBox`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `VirtualBox` WRITE;
/*!40000 ALTER TABLE `VirtualBox` DISABLE KEYS */;
/*!40000 ALTER TABLE `VirtualBox` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `VirtualBoxDropRate`
--

DROP TABLE IF EXISTS `VirtualBoxDropRate`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `VirtualBoxDropRate` (
  `id` varchar(191) NOT NULL,
  `boxId` varchar(191) NOT NULL,
  `rarity` enum('COMMON','RARE','EPIC','LEGENDARY') NOT NULL,
  `rate` double NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `VirtualBoxDropRate_boxId_rarity_key` (`boxId`,`rarity`),
  KEY `VirtualBoxDropRate_boxId_idx` (`boxId`),
  CONSTRAINT `VirtualBoxDropRate_boxId_fkey` FOREIGN KEY (`boxId`) REFERENCES `VirtualBox` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `VirtualBoxDropRate`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `VirtualBoxDropRate` WRITE;
/*!40000 ALTER TABLE `VirtualBoxDropRate` DISABLE KEYS */;
/*!40000 ALTER TABLE `VirtualBoxDropRate` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `VirtualBoxOpening`
--

DROP TABLE IF EXISTS `VirtualBoxOpening`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `VirtualBoxOpening` (
  `id` varchar(191) NOT NULL,
  `userId` varchar(191) NOT NULL,
  `boxId` varchar(191) NOT NULL,
  `userCardId` varchar(191) DEFAULT NULL,
  `rarity` enum('COMMON','RARE','EPIC','LEGENDARY') NOT NULL,
  `pricePaid` decimal(10,2) NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `VirtualBoxOpening_userCardId_key` (`userCardId`),
  KEY `VirtualBoxOpening_userId_idx` (`userId`),
  KEY `VirtualBoxOpening_boxId_idx` (`boxId`),
  KEY `VirtualBoxOpening_createdAt_idx` (`createdAt`),
  CONSTRAINT `VirtualBoxOpening_boxId_fkey` FOREIGN KEY (`boxId`) REFERENCES `VirtualBox` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `VirtualBoxOpening_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `VirtualBoxOpening`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `VirtualBoxOpening` WRITE;
/*!40000 ALTER TABLE `VirtualBoxOpening` DISABLE KEYS */;
/*!40000 ALTER TABLE `VirtualBoxOpening` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `VirtualBoxPoolItem`
--

DROP TABLE IF EXISTS `VirtualBoxPoolItem`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `VirtualBoxPoolItem` (
  `id` varchar(191) NOT NULL,
  `boxId` varchar(191) NOT NULL,
  `gachaCardId` varchar(191) NOT NULL,
  `rarity` enum('COMMON','RARE','EPIC','LEGENDARY') NOT NULL,
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `VirtualBoxPoolItem_boxId_gachaCardId_key` (`boxId`,`gachaCardId`),
  KEY `VirtualBoxPoolItem_boxId_rarity_idx` (`boxId`,`rarity`),
  KEY `VirtualBoxPoolItem_gachaCardId_idx` (`gachaCardId`),
  CONSTRAINT `VirtualBoxPoolItem_boxId_fkey` FOREIGN KEY (`boxId`) REFERENCES `VirtualBox` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `VirtualBoxPoolItem_gachaCardId_fkey` FOREIGN KEY (`gachaCardId`) REFERENCES `GachaCard` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `VirtualBoxPoolItem`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `VirtualBoxPoolItem` WRITE;
/*!40000 ALTER TABLE `VirtualBoxPoolItem` DISABLE KEYS */;
/*!40000 ALTER TABLE `VirtualBoxPoolItem` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `Voucher`
--

DROP TABLE IF EXISTS `Voucher`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `Voucher` (
  `id` varchar(191) NOT NULL,
  `code` varchar(191) NOT NULL,
  `title` varchar(191) NOT NULL,
  `discountType` enum('PERCENT','FIXED') NOT NULL DEFAULT 'PERCENT',
  `discountValue` decimal(10,2) NOT NULL,
  `maxDiscountAmount` decimal(10,2) DEFAULT NULL,
  `minOrderAmount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `totalQuantity` int(11) DEFAULT NULL,
  `usedQuantity` int(11) NOT NULL DEFAULT 0,
  `limitPerUser` int(11) NOT NULL DEFAULT 1,
  `startAt` datetime(3) DEFAULT NULL,
  `endAt` datetime(3) DEFAULT NULL,
  `isActive` tinyint(1) NOT NULL DEFAULT 1,
  `scope` enum('ALL','CATEGORY','PRODUCT') NOT NULL DEFAULT 'ALL',
  `scopeIds` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`scopeIds`)),
  `createdAt` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updatedAt` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Voucher_code_key` (`code`),
  KEY `Voucher_isActive_idx` (`isActive`),
  KEY `Voucher_endAt_idx` (`endAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Voucher`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `Voucher` WRITE;
/*!40000 ALTER TABLE `Voucher` DISABLE KEYS */;
/*!40000 ALTER TABLE `Voucher` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `_ProductSets`
--

DROP TABLE IF EXISTS `_ProductSets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `_ProductSets` (
  `A` varchar(191) NOT NULL,
  `B` varchar(191) NOT NULL,
  UNIQUE KEY `_ProductSets_AB_unique` (`A`,`B`),
  KEY `_ProductSets_B_index` (`B`),
  CONSTRAINT `_ProductSets_A_fkey` FOREIGN KEY (`A`) REFERENCES `Product` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `_ProductSets_B_fkey` FOREIGN KEY (`B`) REFERENCES `Set` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_ProductSets`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `_ProductSets` WRITE;
/*!40000 ALTER TABLE `_ProductSets` DISABLE KEYS */;
/*!40000 ALTER TABLE `_ProductSets` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;

--
-- Table structure for table `_prisma_migrations`
--

DROP TABLE IF EXISTS `_prisma_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `_prisma_migrations` (
  `id` varchar(36) NOT NULL,
  `checksum` varchar(64) NOT NULL,
  `finished_at` datetime(3) DEFAULT NULL,
  `migration_name` varchar(255) NOT NULL,
  `logs` text DEFAULT NULL,
  `rolled_back_at` datetime(3) DEFAULT NULL,
  `started_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `applied_steps_count` int(10) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `_prisma_migrations`
--

SET @OLD_AUTOCOMMIT=@@AUTOCOMMIT, @@AUTOCOMMIT=0;
LOCK TABLES `_prisma_migrations` WRITE;
/*!40000 ALTER TABLE `_prisma_migrations` DISABLE KEYS */;
INSERT INTO `_prisma_migrations` VALUES
('199f2ef1-4e96-46f3-88d9-ffcd29c835fe','0b6797078b1bc8b27f0f623313e843e1c0aa26ec105ba49e27202622c771f4aa','2026-09-15 10:28:26.463','20260907081641_init_mariadb',NULL,NULL,'2026-09-15 10:28:25.502',1),
('227b45f8-e758-4887-9a35-bc11e5d1b656','d0fed6b8458436aa71ef3d3d2657850d87e97c386192e4bacd88876276204f21','2026-09-15 10:28:26.624','20260914130000_remove_legacy_chat_add_site_settings',NULL,NULL,'2026-09-15 10:28:26.587',1),
('6ae634b1-4571-4ba7-92a8-fd1a09c6dc2e','908e4dae91af072fba0872b17c805704fe9050053171f6c9e6ce10ec57b5548e','2026-09-15 10:28:26.522','20260913044331_add_product_tcg_metadata',NULL,NULL,'2026-09-15 10:28:26.485',1),
('c82fe08e-aac9-43c9-9e10-0e38fd727adb','4951071b961f98926583fe1f91a0749a25ae2f9b95af8cfa4cfb22368793494b','2026-09-15 10:28:26.484','20260909083000_widen_refresh_token_columns',NULL,NULL,'2026-09-15 10:28:26.463',1),
('ddee316c-be5f-428f-b904-78297090053a','500a8b846816f558651a03f9b5ebff49aa7e7f9ac4c6bce7027de91601abcdc2','2026-09-15 10:28:26.586','20260913053607_product_attribute_filters',NULL,NULL,'2026-09-15 10:28:26.523',1);
/*!40000 ALTER TABLE `_prisma_migrations` ENABLE KEYS */;
UNLOCK TABLES;
COMMIT;
SET AUTOCOMMIT=@OLD_AUTOCOMMIT;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-09-17 17:29:24
