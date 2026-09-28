-- Widen RefreshToken.token from VARCHAR(191) to VARCHAR(512).
--
-- JWT refresh tokens (HS256, 7d expiry, sub + jti claims) are ~210 chars,
-- which overflowed VARCHAR(191) and raised P2000 on login.
--
-- @db.Text is intentionally NOT used: MySQL/MariaDB cannot put a UNIQUE
-- index on a TEXT column, and Prisma rejects `@unique @db.Text` at schema
-- validation. VARCHAR(512) keeps the unique index intact:
--   512 chars * 4 bytes (utf8mb4) = 2048 bytes < 3072-byte InnoDB limit.
-- replacedByToken is widened alongside `token` since it stores the same
-- full-token values during rotation.
--
-- MODIFY on an indexed column rebuilds the index; existing tokens (<191
-- chars) truncate to nothing — data is preserved, only the type widens.

ALTER TABLE `RefreshToken` MODIFY `token` VARCHAR(512) NOT NULL;
ALTER TABLE `RefreshToken` MODIFY `replacedByToken` VARCHAR(512) NULL;
