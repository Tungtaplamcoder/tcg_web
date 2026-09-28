/* Minimal merchandising category taxonomy.
 *
 * The category tree stays deliberately tiny — every product is either a
 * Sealed Product or a Single Card. Domain metadata (language, rarity,
 * card set) is NEVER represented as categories: those live on the
 * Product row itself (language / rarity / cardSet columns) and are
 * filtered via dynamic attribute filters, not via the category tree.
 *
 * `PRODUCT_CATEGORY_KEYS` values are the semantic keys the admin API
 * accepts (frontend forms use them); each maps to a canonical Category
 * row resolved by slug at runtime — the DB is the source of truth.
 * LEGACY_ALIASES keeps old `box`/`card` deep links working.
 */

const PRODUCT_CATEGORY_KEYS = Object.freeze(['BOX', 'CARD']);

const PRODUCT_CATEGORIES = Object.freeze({
  BOX: Object.freeze({
    key: 'BOX',
    slug: 'sealed-products',
    name: 'Sealed Products',
    description: 'Sealed booster boxes, ETBs and special collections'
  }),
  CARD: Object.freeze({
    key: 'CARD',
    slug: 'single-cards',
    name: 'Single Cards',
    description: 'Authenticated singles and chase cards'
  })
});

// Legacy slug/label spellings → semantic key. Old deep links and API
// clients that send `box`/`card` (or the old key itself) keep working.
const LEGACY_ALIASES = Object.freeze({
  box: 'BOX',
  sealedbox: 'BOX',
  sealedboxes: 'BOX',
  sealedproducts: 'BOX',
  card: 'CARD',
  singlecard: 'CARD',
  singlecards: 'CARD'
});

// Resolve any user/client input (key, slug, category name) to a
// semantic category key, or null when it does not match the taxonomy.
const resolveProductCategoryKey = (input) => {
  if (!input) return null;
  if (PRODUCT_CATEGORIES[input]) return input;
  const norm = String(input).trim().toLowerCase().replace(/[^a-z]/g, '');
  if (LEGACY_ALIASES[norm]) return LEGACY_ALIASES[norm];
  // Canonical slug form: sealed-products / single-cards (hyphens are
  // stripped above, so compare the compact slug too).
  const canonical = Object.values(PRODUCT_CATEGORIES).find(
    (def) => def.slug.replace(/-/g, '') === norm
  );
  return canonical ? canonical.key : null;
};

module.exports = { PRODUCT_CATEGORY_KEYS, PRODUCT_CATEGORIES, resolveProductCategoryKey };
