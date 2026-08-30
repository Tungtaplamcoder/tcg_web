const PRODUCT_CATEGORY_ENUM = ['BOX', 'CARD'];

const PRODUCT_CATEGORIES = Object.freeze({
  BOX: Object.freeze({ key: 'BOX', slug: 'box', name: 'Box', description: 'Sealed Boxes' }),
  CARD: Object.freeze({ key: 'CARD', slug: 'card', name: 'Card', description: 'Single Cards' })
});

const resolveProductCategoryKey = (input) => {
  if (!input) return null;
  if (PRODUCT_CATEGORIES[input]) return input;
  const norm = String(input).trim().toLowerCase().replace(/[^a-z]/g, '');
  if (norm === 'box' || norm === 'sealedbox' || norm === 'sealedboxes') return 'BOX';
  if (norm === 'card' || norm === 'singlecard' || norm === 'singlecards') return 'CARD';
  return null;
};

module.exports = { PRODUCT_CATEGORY_ENUM, PRODUCT_CATEGORIES, resolveProductCategoryKey };
