-- Expand granular staff permissions to cover all 5 operational modules of the
-- Staff Panel sidebar: Orders, Inventory, Virtual Box, Posts, Vouchers.
--
-- The existing model only tracked inventory (canManageInventory) and posts
-- (canManagePosts). This migration adds the three missing boolean flags so an
-- Admin can independently toggle every module per Staff account:
--   canManageOrders     -> Đơn hàng
--   canManageVirtualBox -> Hộp ảo
--   canManageVouchers   -> Voucher
--
-- Existing STAFF/ADMIN rows keep their effective access: before this change
-- STAFF/ADMIN could already reach orders (ROLE_DEFAULT_PERMISSIONS) and the
-- whole admin surface, so the new flags default to true for those roles.
-- Everyone else (CUSTOMER) stays false.

ALTER TABLE `User`
  ADD COLUMN `canManageOrders`     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `canManageVirtualBox` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `canManageVouchers`   BOOLEAN NOT NULL DEFAULT false;

UPDATE `User`
SET `canManageOrders`     = true,
    `canManageVirtualBox` = true,
    `canManageVouchers`   = true
WHERE `role` IN ('ADMIN', 'STAFF');
