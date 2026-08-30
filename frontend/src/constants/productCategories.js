export const PRODUCT_CATEGORIES = [
  {
    value: 'BOX',
    label: 'Box',
    description: 'Sealed Boxes',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    value: 'CARD',
    label: 'Card',
    description: 'Single Cards',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
  }
];

export const PRODUCT_CATEGORY_MAP = PRODUCT_CATEGORIES.reduce((acc, cat) => {
  acc[cat.value] = cat;
  return acc;
}, {});

export const resolveCategoryKey = (category) => {
  if (!category) return null;
  if (PRODUCT_CATEGORY_MAP[category]) return category;
  const source = typeof category === 'string' ? category : (category.slug || category.name || '');
  const norm = String(source).toLowerCase().replace(/[^a-z]/g, '');
  if (norm === 'box' || norm === 'sealedbox' || norm === 'sealedboxes') return 'BOX';
  if (norm === 'card' || norm === 'singlecard' || norm === 'singlecards') return 'CARD';
  return null;
};

export const getProductCategory = (product) => {
  const key = resolveCategoryKey(product?.category);
  return key ? PRODUCT_CATEGORY_MAP[key] : null;
};
