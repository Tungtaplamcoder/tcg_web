import React from 'react';
import { Box, Layers } from 'lucide-react';
import { resolveCategoryKey, MAIN_TYPES } from '../constants/productCategories';

/**
 * CategoryBadge — the binary storefront taxonomy pill.
 * Products are either BOX / SEALED (sealed products) or CARD (single
 * cards); this badge always resolves to one of those two canonical
 * labels, preferring an explicit main_type (SEALED_PRODUCT /
 * SINGLE_CARD) and otherwise deriving the key from the product's
 * category (falling back to the legacy rarity='BOX' convention when
 * the category is absent).
 */
const BADGE_META = {
  BOX: { label: 'SEALED', cls: 'from-emerald-400 via-emerald-500 to-teal-600', Icon: Box },
  CARD: { label: 'CARD', cls: 'from-fuchsia-500 via-violet-500 to-purple-500', Icon: Layers }
};

const CategoryBadge = ({ category, rarity, mainType, size = 'sm', className = '' }) => {
  // An explicit main_type is authoritative; only otherwise derive from
  // the category tree, with the legacy rarity='BOX' convention as fallback.
  const explicit = String(mainType || '').trim().toUpperCase();
  const explicitKey = explicit === MAIN_TYPES.SEALED_PRODUCT ? 'BOX'
    : explicit === MAIN_TYPES.SINGLE_CARD ? 'CARD'
      : null;
  const fallback = String(rarity || '').trim().toUpperCase() === 'BOX' ? 'BOX' : 'CARD';
  const key = explicitKey || resolveCategoryKey(category) || fallback;
  const meta = BADGE_META[key] || BADGE_META.CARD;
  const Icon = meta.Icon;
  const sizing = size === 'lg' ? 'text-[12px] px-3 py-1.5' : 'text-[10px] px-2.5 py-1';
  return (
    <span
      className={`relative inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.14em] text-white shadow-lg overflow-hidden ${sizing} ${className}`}
    >
      <span className={`absolute inset-0 bg-gradient-to-r ${meta.cls}`} />
      <span className="foil-sheen absolute inset-0" />
      <span className="relative z-10 inline-flex items-center gap-1">
        {Icon && <Icon className={size === 'lg' ? 'h-3.5 w-3.5' : 'h-3 w-3'} aria-hidden="true" />}
        {meta.label}
      </span>
    </span>
  );
};

export default CategoryBadge;
