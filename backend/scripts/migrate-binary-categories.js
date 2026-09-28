// One-time migration helper: move every product onto the minimal
// merchandising taxonomy — Sealed Products (slug: sealed-products) or
// Single Cards (slug: single-cards). Language/rarity/card-set stay on
// the Product row as attributes; they are NEVER categories.
// Idempotent: safe to run multiple times.
require('dotenv').config();
const { PrismaClient } = require('../src/generated/prisma');

const prisma = new PrismaClient();

const MERCH_CATEGORIES = {
  BOX: { slug: 'sealed-products', name: 'Sealed Products', description: 'Sealed booster boxes, ETBs and special collections' },
  CARD: { slug: 'single-cards', name: 'Single Cards', description: 'Authenticated singles and chase cards' }
};

async function main() {
  const boxCategory = await prisma.category.upsert({
    where: { slug: MERCH_CATEGORIES.BOX.slug },
    update: {},
    create: { ...MERCH_CATEGORIES.BOX, isActive: true }
  });
  const cardCategory = await prisma.category.upsert({
    where: { slug: MERCH_CATEGORIES.CARD.slug },
    update: {},
    create: { ...MERCH_CATEGORIES.CARD, isActive: true }
  });
  console.log(`Ensured categories: ${boxCategory.name} (${boxCategory.id}), ${cardCategory.name} (${cardCategory.id})`);

  // Legacy convention: rarity 'BOX' marked sealed products
  const boxResult = await prisma.product.updateMany({
    where: { OR: [{ rarity: 'BOX' }, { category: { slug: 'box' } }] },
    data: { categoryId: boxCategory.id }
  });
  const cardResult = await prisma.product.updateMany({
    where: { category: { slug: 'card' } },
    data: { categoryId: cardCategory.id }
  });
  console.log(`Assigned Sealed Products: ${boxResult.count} product(s), Single Cards: ${cardResult.count} product(s)`);

  const remaining = await prisma.product.count({ where: { categoryId: null } });
  console.log(remaining === 0 ? 'All products classified.' : `WARNING: ${remaining} product(s) still unclassified.`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
