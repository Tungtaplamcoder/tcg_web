import vi from './locales/vi.js';
import en from './locales/en.js';

/* ── Central translation dictionary ─────────────────────────────────────
    Single source of truth: vi + en locale dictionaries (key-for-key
    mirrored) plus this module's global extensions. `t(key)` resolves
    against the active language, falls back to vi, then to the raw key.
    Locale dictionaries live in ./locales; shared cross-page namespaces
    that depend on runtime data (not pure copy) live below so both
    dictionaries can import the same shape. */

export const TRANSLATIONS = { vi, en };
export { vi, en };
