-- Remove the legacy WebSocket customer-support chat system and prepare the
-- AppSetting key-value store for site configuration settings.
--
-- 1) Drop the legacy chat tables (ChatMessage, ChatParticipant, ChatRoom).
--    The ChatRoom_orderId_fkey FK on ChatRoom (ON DELETE SET NULL) is dropped
--    together with the table, so `Order` needs no separate ALTER.
-- 2) Drop the per-user legacy chat permission flag (canAccessChat) — chat
--    access is gone entirely; role permissions no longer reference it.
-- 3) Widen AppSetting.value from VARCHAR(191) to VARCHAR(512) so long URLs
--    (site_favicon_url, support_chat_url) fit comfortably.
--    512 * 4 bytes (utf8mb4) = 2048B < 3072B InnoDB index key limit.
-- 4) Seed default site settings rows (idempotent INSERT IGNORE):
--    site:site_title, site:site_favicon_url, site:support_chat_url.

-- ==== 1) Drop legacy chat tables (children first) ====
DROP TABLE IF EXISTS `ChatMessage`;
DROP TABLE IF EXISTS `ChatParticipant`;
DROP TABLE IF EXISTS `ChatRoom`;

-- ==== 2) Drop legacy per-user chat permission flag ====
ALTER TABLE `User` DROP COLUMN `canAccessChat`;

-- ==== 3) Widen AppSetting.value for long URLs ====
ALTER TABLE `AppSetting` MODIFY `value` VARCHAR(512) NOT NULL;

-- ==== 4) Seed default site settings (idempotent) ====
INSERT IGNORE INTO `AppSetting` (`key`, `value`, `updatedAt`)
VALUES
  ('site:site_title', 'TCG Store', CURRENT_TIMESTAMP(3)),
  ('site:site_favicon_url', '', CURRENT_TIMESTAMP(3)),
  ('site:support_chat_url', 'https://m.me/1251937284677510', CURRENT_TIMESTAMP(3));
