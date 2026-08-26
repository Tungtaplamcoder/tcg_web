// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('Cleaning existing data...');

  // Delete in dependency-safe order
  await prisma.orderStatusHistory.deleteMany({});
  await prisma.paymentLog.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.chatMessage.deleteMany({});
  await prisma.chatParticipant.deleteMany({});
  await prisma.chatRoom.deleteMany({});
  await prisma.card.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.set.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Creating users...');

  const adminPassword = await hashPassword('Admin@123');
  const staffPassword = await hashPassword('Staff@123');
  const customerPassword = await hashPassword('Customer@123');

  // Admin user
  const admin = await prisma.user.create({
    data: {
      email: 'admin@tcg.com',
      passwordHash: adminPassword,
      fullName: 'Admin User',
      phone: '+84900000001',
      address: '1 Admin St, Hanoi',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      canManageInventory: true,
      canManagePosts: true,
      canAccessChat: true
    }
  });

  // Staff user
  const staff = await prisma.user.create({
    data: {
      email: 'staff@tcg.com',
      passwordHash: staffPassword,
      fullName: 'Staff User',
      phone: '+84900000002',
      address: '2 Staff St, Hanoi',
      role: 'STAFF',
      status: 'ACTIVE',
      emailVerified: true,
      canManageInventory: true,
      canManagePosts: true,
      canAccessChat: true
    }
  });

  // Customer user
  const customer = await prisma.user.create({
    data: {
      email: 'customer@tcg.com',
      passwordHash: customerPassword,
      fullName: 'Customer User',
      phone: '+84900000003',
      address: '3 Customer St, Hanoi',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      emailVerified: true
    }
  });

  console.log(`Created users: ${admin.email}, ${staff.email}, ${customer.email}`);

  // Create Categories
  console.log('Creating categories...');
  const pokemonCategory = await prisma.category.create({
    data: {
      name: 'Pokemon',
      slug: 'pokemon',
      description: 'Pokemon Trading Card Game cards and boxes',
      imageUrl: 'https://example.com/pokemon-category.jpg',
      isActive: true
    }
  });

  const yugiohCategory = await prisma.category.create({
    data: {
      name: 'Yu-Gi-Oh!',
      slug: 'yu-gi-oh',
      description: 'Yu-Gi-Oh! Trading Card Game cards',
      imageUrl: 'https://example.com/yugioh-category.jpg',
      isActive: true
    }
  });

  const mtgCategory = await prisma.category.create({
    data: {
      name: 'Magic: The Gathering',
      slug: 'magic-the-gathering',
      description: 'Magic: The Gathering singles and boxes',
      imageUrl: 'https://example.com/mtg-category.jpg',
      isActive: true
    }
  });

  console.log(`Created categories: ${pokemonCategory.name}, ${yugiohCategory.name}, ${mtgCategory.name}`);

  // Create Sets
  console.log('Creating sets...');
  const vividVoltage = await prisma.set.create({
    data: {
      name: 'Vivid Voltage',
      slug: 'vivid-voltage',
      releaseDate: new Date('2020-11-13'),
      description: 'Pokemon Vivid Voltage expansion',
      imageUrl: 'https://example.com/vivid-voltage.jpg'
    }
  });

  const battleStyles = await prisma.set.create({
    data: {
      name: 'Battle Styles',
      slug: 'battle-styles',
      releaseDate: new Date('2021-03-19'),
      description: 'Pokemon Battle Styles expansion',
      imageUrl: 'https://example.com/battle-styles.jpg'
    }
  });

  const legendOfBlueEyes = await prisma.set.create({
    data: {
      name: 'Legend of Blue Eyes White Dragon',
      slug: 'legend-of-blue-eyes',
      releaseDate: new Date('2002-03-08'),
      description: 'Yu-Gi-Oh! Legend of Blue Eyes White Dragon set',
      imageUrl: 'https://example.com/lob.jpg'
    }
  });

  const modernHorizons = await prisma.set.create({
    data: {
      name: 'Modern Horizons 2',
      slug: 'modern-horizons-2',
      releaseDate: new Date('2021-06-18'),
      description: 'Magic: The Gathering Modern Horizons 2',
      imageUrl: 'https://example.com/mh2.jpg'
    }
  });

  console.log('Created sets.');

  // Create Products
  console.log('Creating products...');

  const productsData = [
    // Pokemon Singles
    {
      name: 'Pikachu VMAX',
      shortName: 'Pikachu VMAX',
      slug: 'pikachu-vmax',
      description: 'Pikachu VMAX from Vivid Voltage, highly sought after.',
      category: pokemonCategory.id,
      sets: [vividVoltage.id],
      cardNumber: '044/185',
      rarity: 'ULTRA_RARE',
      condition: 'NEAR_MINT',
      price: 149.99,
      stockQuantity: 5,
      images: ['https://example.com/pikachu-vmax.jpg'],
      attributes: { holo: true, firstEdition: false }
    },
    {
      name: 'Charizard VMAX',
      shortName: 'Charizard VMAX',
      slug: 'charizard-vmax',
      description: 'Charizard VMAX from Battle Styles.',
      category: pokemonCategory.id,
      sets: [battleStyles.id],
      cardNumber: '012/163',
      rarity: 'SECRET_RARE',
      condition: 'NEAR_MINT',
      price: 299.99,
      stockQuantity: 2,
      images: ['https://example.com/charizard-vmax.jpg'],
      attributes: { holo: true, firstEdition: false }
    },
    {
      name: 'Shining Fates Elite Trainer Box',
      shortName: 'Shining Fates ETB',
      slug: 'shining-fates-etb',
      description: 'Shining Fates Elite Trainer Box with 10 booster packs.',
      category: pokemonCategory.id,
      sets: [],
      cardNumber: null,
      rarity: 'BOX',
      condition: 'MINT',
      price: 59.99,
      stockQuantity: 10,
      images: ['https://example.com/shining-fates-etb.jpg'],
      attributes: { type: 'box', packs: 10 }
    },
    // Yu-Gi-Oh Singles
    {
      name: 'Blue-Eyes White Dragon',
      shortName: 'Blue-Eyes White Dragon',
      slug: 'blue-eyes-white-dragon',
      description: 'Blue-Eyes White Dragon from Legend of Blue Eyes White Dragon.',
      category: yugiohCategory.id,
      sets: [legendOfBlueEyes.id],
      cardNumber: 'LOB-001',
      rarity: 'ULTRA_RARE',
      condition: 'NEAR_MINT',
      price: 199.99,
      stockQuantity: 3,
      images: ['https://example.com/blue-eyes.jpg'],
      attributes: { firstEdition: true }
    },
    {
      name: 'Dark Magician',
      shortName: 'Dark Magician',
      slug: 'dark-magician',
      description: 'Dark Magician from Legend of Blue Eyes White Dragon.',
      category: yugiohCategory.id,
      sets: [legendOfBlueEyes.id],
      cardNumber: 'LOB-002',
      rarity: 'ULTRA_RARE',
      condition: 'EXCELLENT',
      price: 89.99,
      stockQuantity: 4,
      images: ['https://example.com/dark-magician.jpg'],
      attributes: { firstEdition: false }
    },
    // MTG Singles
    {
      name: 'Ragavan, Nimble Pilferer',
      shortName: 'Ragavan',
      slug: 'ragavan-nimble-pilferer',
      description: 'Ragavan from Modern Horizons 2.',
      category: mtgCategory.id,
      sets: [modernHorizons.id],
      cardNumber: '137/303',
      rarity: 'MYTHIC',
      condition: 'NEAR_MINT',
      price: 89.99,
      stockQuantity: 6,
      images: ['https://example.com/ragavan.jpg'],
      attributes: { foil: false }
    },
    {
      name: 'Modern Horizons 2 Booster Box',
      shortName: 'MH2 Booster Box',
      slug: 'modern-horizons-2-booster-box',
      description: 'Modern Horizons 2 Booster Box with 36 packs.',
      category: mtgCategory.id,
      sets: [modernHorizons.id],
      cardNumber: null,
      rarity: 'BOX',
      condition: 'MINT',
      price: 249.99,
      stockQuantity: 8,
      images: ['https://example.com/mh2-box.jpg'],
      attributes: { type: 'box', packs: 36 }
    }
  ];

  const createdProducts = [];
  for (const productData of productsData) {
    const { category, sets, ...rest } = productData;
    const product = await prisma.product.create({
      data: {
        ...rest,
        category: { connect: { id: category } },
        sets: sets.length > 0 ? { connect: sets.map(id => ({ id })) } : undefined
      }
    });
    createdProducts.push(product);
    console.log(`Created product: ${product.name}`);
  }

  // Create individual Cards for singles
  console.log('Creating individual card items...');

  const singleProducts = createdProducts.filter(p => p.rarity !== 'BOX');
  for (const product of singleProducts) {
    const cardCount = Math.min(product.stockQuantity, 3); // create up to 3 card items per product
    for (let i = 0; i < cardCount; i++) {
      await prisma.card.create({
        data: {
          sku: `${product.slug.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
          productId: product.id,
          condition: product.condition,
          status: 'AVAILABLE',
          purchasePrice: Math.round(Number(product.price) * 0.6 * 100) / 100,
          notes: 'Seeded card'
        }
      });
    }
  }

  console.log('Created individual cards.');

  console.log('Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });