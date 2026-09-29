/* Minimal merchandising taxonomy — mirrored from
 * backend/src/constants/productCategories.js. The semantic keys
 * (BOX/CARD) are what forms send to the API; each maps to a canonical
 * category slug resolved by the backend (DB is the source of truth).
 * Language / rarity / card set are product attributes — they live in
 * tcgMetadata.js and are NEVER hardcoded into categories. */

export const PRODUCT_CATEGORIES = [
  {
    value: 'BOX',
    label: 'Sealed Products',
    slug: 'sealed-products',
    description: 'Sealed booster boxes, ETBs and special collections',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    value: 'CARD',
    label: 'Single Cards',
    slug: 'single-cards',
    description: 'Authenticated singles and chase cards',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
  }
];

export const PRODUCT_CATEGORY_MAP = PRODUCT_CATEGORIES.reduce((acc, cat) => {
  acc[cat.value] = cat;
  return acc;
}, {});

// Legacy spellings → semantic key (old deep links keep working)
const LEGACY_ALIASES = {
  box: 'BOX',
  sealedbox: 'BOX',
  sealedboxes: 'BOX',
  sealedproducts: 'BOX',
  card: 'CARD',
  singlecard: 'CARD',
  singlecards: 'CARD'
};

// Level-2 sealed sub-types (slug / normalized name) — these live UNDER the
// Sealed Products root, so they must resolve to BOX instead of falling back
// to the CARD default. Kept in sync with backend/prisma SEALED_TYPES.
//
// Real labels carry store prefixes/suffixes (e.g. "E2E Booster Box
// 1790023487846", slug "e2e-booster-box-1790023487846"), so the compacted
// token is matched as a SUBSTRING — an exact Set lookup misses every such
// category and wrongly defaults sealed boxes to CARD/THẺ.
const SEALED_TYPE_HINTS = [
  'boosterbox',
  'elitetrainerbox',
  'elitetrainerboxetb',
  'boosterpack',
  'specialcollectionbox',
  'tinbox',
  'sealed'
];

export const resolveCategoryKey = (category) => {
  if (!category) return null;
  if (PRODUCT_CATEGORY_MAP[category]) return category;
  const source = typeof category === 'string' ? category : (category.slug || category.name || '');
  const norm = String(source).toLowerCase().replace(/[^a-z]/g, '');
  if (LEGACY_ALIASES[norm]) return LEGACY_ALIASES[norm];
  if (SEALED_TYPE_HINTS.some((hint) => norm.includes(hint))) return 'BOX';
  const canonical = PRODUCT_CATEGORIES.find((cat) => cat.slug.replace(/-/g, '') === norm);
  return canonical ? canonical.value : null;
};

export const MAIN_TYPES = {
  SEALED_PRODUCT: 'SEALED_PRODUCT',
  SINGLE_CARD: 'SINGLE_CARD'
};

/**
 * Resolve a product's main type. Prefers an explicit `main_type` field
 * when the API exposes one (SEALED_PRODUCT / SINGLE_CARD), otherwise
 * derives it from the category tree (sealed sub-types → sealed) with the
 * legacy rarity='BOX' convention as a last resort.
 */
export const resolveProductMainType = (product) => {
  const explicit = product?.main_type || product?.mainType || product?.productType;
  if (explicit) {
    const norm = String(explicit).trim().toUpperCase().replace(/[^A-Z]/g, '');
    if (['SEALEDPRODUCT', 'SEALED', 'BOX'].includes(norm)) return MAIN_TYPES.SEALED_PRODUCT;
    if (['SINGLECARD', 'SINGLE', 'CARD'].includes(norm)) return MAIN_TYPES.SINGLE_CARD;
  }
  const key = resolveCategoryKey(product?.category) ||
    (String(product?.rarity || '').trim().toUpperCase() === 'BOX' ? 'BOX' : null);
  return key === 'BOX' ? MAIN_TYPES.SEALED_PRODUCT : MAIN_TYPES.SINGLE_CARD;
};

export const getProductCategory = (product) => {
  const key = resolveCategoryKey(product?.category);
  return key ? PRODUCT_CATEGORY_MAP[key] : null;
};
