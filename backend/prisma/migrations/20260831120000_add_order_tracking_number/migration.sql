-- Additive migration: store the shipping tracking number captured when
-- staff/admin starts shipping (PACKAGING -> SHIPPING).
ALTER TABLE "Order" ADD COLUMN "trackingNumber" TEXT;
