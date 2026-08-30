// One-time migration (Phase 1B): move every product onto the binary
// category classification — Box (Sealed Boxes) or Card (Single Cards).
// Products with rarity 'BOX' become Box; all others become Card.
// Upserts the canonical Box/Card categories if they do not exist.
// Idempotent: safe to run multiple times.
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BINARY_CATEGORIES = {
  BOX: { slug: 'box', name: 'Box', description: 'Sealed Boxes' },
  CARD: { slug: 'card', name: 'Card', description: 'Single Cards' }
};

async function main() {
  const boxCategory = await prisma.category.upsert({
    where: { slug: BINARY_CATEGORIES.BOX.slug },
    update: {},
    create: { ...BINARY_CATEGORIES.BOX, isActive: true }
  });
  const cardCategory = await prisma.category.upsert({
    where: { slug: BINARY_CATEGORIES.CARD.slug },
    update: {},
    create: { ...BINARY_CATEGORIES.CARD, isActive: true }
  });
  console.log(`Ensured categories: Box (${boxCategory.id}), Card (${cardCategory.id})`);

  const boxResult = await prisma.product.updateMany({
    where: { rarity: 'BOX' },
    data: { categoryId: boxCategory.id }
  });
  const cardResult = await prisma.product.updateMany({
    where: { NOT: { rarity: 'BOX' } },
    data: { categoryId: cardCategory.id }
  });
  console.log(`Assigned Box: ${boxResult.count} product(s), Card: ${cardResult.count} product(s)`);

  const remaining = await prisma.product.count({ where: { categoryId: null } });
  console.log(remaining === 0 ? 'All products classified.' : `WARNING: ${remaining} product(s) still unclassified.`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
