// TCG metadata constants for single cards and sealed products.
// These lists are intentionally decoupled from PRODUCT_CATEGORIES —
// categories stay binary (Box | Card) while card-specific attributes
// (language, rarity, card set) live here and are rendered conditionally
// based on the selected category. Rarities are NEVER hardcoded into
// category dropdowns.

// Full canonical language names — falling back short codes (JP/ENG/CN/KR) are
// no longer used. The live product modal/filter read the CardLanguage catalogue
// (GET /languages); this static list is only a conservative fallback/reference.
export const TCG_LANGUAGES = [
  { value: 'Japanese', label: 'Japanese' },
  { value: 'English', label: 'English' },
  { value: 'Chinese', label: 'Chinese' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Vietnamese', label: 'Vietnamese' }
];

export const TCG_LANGUAGE_MAP = TCG_LANGUAGES.reduce((acc, lang) => {
  acc[lang.value] = lang;
  return acc;
}, {});

export const resolveLanguageKey = (language) => {
  if (!language) return null;
  const value = typeof language === 'string' ? language : (language.value || '');
  const norm = String(value).trim().toUpperCase();
  return TCG_LANGUAGE_MAP[norm] ? norm : null;
};

export const getProductLanguage = (product) => {
  const key = resolveLanguageKey(product?.language);
  return key ? TCG_LANGUAGE_MAP[key] : null;
};

// Languages available for Single Cards (TCG Information section and variants)
export const SINGLE_CARD_LANGUAGES = [
  { value: 'Japanese', label: 'Japanese' },
  { value: 'English', label: 'English' },
  { value: 'Chinese', label: 'Chinese' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Vietnamese', label: 'Vietnamese' }
];

// Languages available for Sealed Products (variants only - no Chinese)
export const SEALED_PRODUCT_LANGUAGES = [
  { value: 'Japanese', label: 'Japanese' },
  { value: 'English', label: 'English' },
  { value: 'Korean', label: 'Korean' }
];

// Rarity is a free-form value on the product (API payload `rarity`), so this
// list only powers the admin select's suggestions. `__CUSTOM__` lets staff
// type any rarity not covered by the list.
export const TCG_RARITIES = [
  { value: 'SAR', label: 'SAR', description: 'Special Art Rare' },
  { value: 'SIR', label: 'SIR', description: 'Special Illustration Rare' },
  { value: 'AR', label: 'AR', description: 'Art Rare' },
  { value: 'IR', label: 'IR', description: 'Illustration Rare' },
  { value: 'SR', label: 'SR', description: 'Super Rare' },
  { value: 'RR', label: 'RR', description: 'Double Rare' },
  { value: 'R', label: 'R', description: 'Rare' },
  { value: 'U', label: 'U', description: 'Uncommon' },
  { value: 'C', label: 'C', description: 'Common' }
];

export const TCG_RARITY_MAP = TCG_RARITIES.reduce((acc, rarity) => {
  acc[rarity.value] = rarity;
  return acc;
}, {});

// Condition options for Single Card variants
export const CARD_CONDITIONS = [
  { value: 'NEAR_MINT', label: 'Near Mint' },
  { value: 'LIGHTLY_PLAYED', label: 'Lightly Played' },
  { value: 'MODERATELY_PLAYED', label: 'Moderately Played' },
  { value: 'HEAVILY_PLAYED', label: 'Heavily Played' },
  { value: 'DAMAGED', label: 'Damaged' }
];

// Categories that carry TCG metadata inputs (language, rarity, cardSet).
// Extend this set when new dynamic product types need the metadata block.
export const TCG_METADATA_CATEGORIES = ['CARD'];

export const categoryHasTcgMetadata = (categoryKey) =>
  TCG_METADATA_CATEGORIES.includes(resolveTcgCategoryKey(categoryKey));

const resolveTcgCategoryKey = (category) => {
  if (!category) return null;
  if (TCG_METADATA_CATEGORIES.includes(category)) return category;
  const norm = String(category).toLowerCase().replace(/[^a-z]/g, '');
  if (norm === 'singlecards') return 'CARD';
  return TCG_METADATA_CATEGORIES.includes(norm.toUpperCase()) ? norm.toUpperCase() : null;
};

// Categories that use variant structure with Condition + Language (Single Cards)
export const VARIANT_CONDITION_LANGUAGE_CATEGORIES = ['CARD'];

// Categories that use variant structure with Language + Version (Sealed Products)
export const VARIANT_LANGUAGE_VERSION_CATEGORIES = ['BOX'];

export const categoryUsesConditionLanguageVariants = (categoryKey) =>
  VARIANT_CONDITION_LANGUAGE_CATEGORIES.includes(resolveVariantCategoryKey(categoryKey));

export const categoryUsesLanguageVersionVariants = (categoryKey) =>
  VARIANT_LANGUAGE_VERSION_CATEGORIES.includes(resolveVariantCategoryKey(categoryKey));

const resolveVariantCategoryKey = (category) => {
  if (!category) return null;
  if (VARIANT_CONDITION_LANGUAGE_CATEGORIES.includes(category)) return category;
  if (VARIANT_LANGUAGE_VERSION_CATEGORIES.includes(category)) return category;
  const norm = String(category).toLowerCase().replace(/[^a-z]/g, '');
  if (norm === 'singlecards') return 'CARD';
  if (norm === 'sealedproducts' || norm === 'box') return 'BOX';
  return null;
};