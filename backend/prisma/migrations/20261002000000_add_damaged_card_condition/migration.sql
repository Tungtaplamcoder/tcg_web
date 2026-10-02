-- Add the DAMAGED value to the shared CardCondition enum.
--
-- The admin product modal already offers "Damaged" as a Single Card variant
-- condition, but the enum (Prisma + DB) never accepted it — submitting such a
-- variant failed with a generic "Invalid input" validation error. MariaDB
-- cannot append a value to an existing ENUM in place, so both enum-backed
-- columns are re-declared with the extra value.
ALTER TABLE `ProductVariant` MODIFY `condition` ENUM('MINT', 'NEAR_MINT', 'LIGHTLY_PLAYED', 'MODERATELY_PLAYED', 'HEAVILY_PLAYED', 'DAMAGED', 'EXCELLENT', 'GOOD', 'POOR') NOT NULL DEFAULT 'NEAR_MINT';

ALTER TABLE `Card` MODIFY `condition` ENUM('MINT', 'NEAR_MINT', 'LIGHTLY_PLAYED', 'MODERATELY_PLAYED', 'HEAVILY_PLAYED', 'DAMAGED', 'EXCELLENT', 'GOOD', 'POOR') NOT NULL DEFAULT 'NEAR_MINT';
