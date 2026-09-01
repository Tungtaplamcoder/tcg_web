// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function main() {
  // =========================================================================
  // IDEMPOTENCY GUARD — this seed runs on every deploy via deploy.sh.
  // If the database already contains data (users/products/orders), exit
  // immediately WITHOUT deleting anything. A redeploy must never wipe data.
  // To force a fresh reseed, delete rows manually or run with SEED_FORCE=1.
  // =========================================================================
  const forceSeed = process.env.SEED_FORCE === '1' || process.env.SEED_FORCE === 'true';
  if (!forceSeed) {
    const [userCount, productCount, orderCount] = await Promise.all([
      prisma.user.count(),
      prisma.product.count(),
      prisma.order.count()
    ]);
    if (userCount > 0 || productCount > 0 || orderCount > 0) {
      console.log(`Seed skipped — database already has data (users: ${userCount}, products: ${productCount}, orders: ${orderCount}).`);
      console.log('Re-deploying does NOT reseed. Set SEED_FORCE=1 to force a fresh seed (destructive).');
      return;
    }
    console.log('Empty database detected — seeding initial data...');
  } else {
    console.log('SEED_FORCE is set — wiping and reseeding demo data...');
  }

  if (forceSeed) {
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
    await prisma.post.deleteMany({}); // Posts reference User.authorId with Restrict
    await prisma.card.deleteMany({});
    await prisma.userCard.deleteMany({});
    await prisma.virtualBoxOpening.deleteMany({});
    await prisma.virtualBoxPoolItem.deleteMany({});
    await prisma.virtualBoxDropRate.deleteMany({});
    await prisma.virtualBox.deleteMany({});
    await prisma.gachaCard.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.set.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.appSetting.deleteMany({});
    await prisma.user.deleteMany({});
  }

  console.log('Creating users...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@tcg.com';
  const adminPassword = await hashPassword(process.env.ADMIN_PASSWORD || 'Admin@123');
  const staffPassword = await hashPassword('Staff@123');
  const customerPassword = await hashPassword('Customer@123');

  // Admin user
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
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
      emailVerified: true,
      balance: 100 // demo balance for gacha openings
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

  // Binary product categories (Phase 1B): every product is either Box or Card
  const boxCategory = await prisma.category.create({
    data: {
      name: 'Box',
      slug: 'box',
      description: 'Sealed Boxes',
      isActive: true
    }
  });

  const cardCategory = await prisma.category.create({
    data: {
      name: 'Card',
      slug: 'card',
      description: 'Single Cards',
      isActive: true
    }
  });

  console.log(`Created binary categories: ${boxCategory.name}, ${cardCategory.name}`);

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
      category: cardCategory.id,
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
      category: cardCategory.id,
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
      category: boxCategory.id,
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
      category: cardCategory.id,
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
      category: cardCategory.id,
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
      category: cardCategory.id,
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
      category: boxCategory.id,
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
    const { category, sets, condition, price, stockQuantity, ...rest } = productData;
    const product = await prisma.product.create({
      data: {
        ...rest,
        category: { connect: { id: category } },
        sets: sets.length > 0 ? { connect: sets.map(id => ({ id })) } : undefined
      }
    });
    createdProducts.push(product);
    console.log(`Created product: ${product.name}`);

    // condition / price / stockQuantity belong to ProductVariant, not Product
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        condition: condition || 'NEAR_MINT',
        price: price != null ? price : 0,
        stockQuantity: stockQuantity != null ? stockQuantity : 0,
        status: 'ACTIVE',
        variant: 'Normal'
      }
    });
  }

  // Create individual Cards for singles
  console.log('Creating individual card items...');

  const singleProducts = createdProducts.filter(p => p.rarity !== 'BOX');
  for (const product of singleProducts) {
    const src = productsData.find(pd => pd.slug === product.slug);
    const cardCount = Math.min(src ? src.stockQuantity : 0, 3); // create up to 3 card items per product
    for (let i = 0; i < cardCount; i++) {
      await prisma.card.create({
        data: {
          sku: `${product.slug.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
          productId: product.id,
          condition: (src && src.condition) || 'NEAR_MINT',
          status: 'AVAILABLE',
          purchasePrice: src ? Math.round(Number(src.price) * 0.6 * 100) / 100 : 0,
          notes: 'Seeded card'
        }
      });
    }
  }

  console.log('Created individual cards.');

  // Create dedicated Gacha cards + Virtual Boxes (gacha) — the gacha pool is
  // fully decoupled from the retail shop inventory: boxes pull from
  // GachaCard rows with their own artwork, set codes and drop weights.
  console.log('Creating gacha cards and virtual boxes...');

  const gachaCardsData = [
    { name: 'Ember Fox', rarity: 'COMMON', setCode: 'GEN-001', imageUrl: 'https://example.com/gacha/ember-fox.jpg' },
    { name: 'Tide Runner', rarity: 'COMMON', setCode: 'GEN-002', imageUrl: 'https://example.com/gacha/tide-runner.jpg' },
    { name: 'Stone Sentinel', rarity: 'COMMON', setCode: 'GEN-003', imageUrl: 'https://example.com/gacha/stone-sentinel.jpg' },
    { name: 'Gale Dancer', rarity: 'RARE', setCode: 'GEN-014', imageUrl: 'https://example.com/gacha/gale-dancer.jpg' },
    { name: 'Void Wanderer', rarity: 'RARE', setCode: 'GEN-019', imageUrl: 'https://example.com/gacha/void-wanderer.jpg' },
    { name: 'Aurora Weaver', rarity: 'EPIC', setCode: 'AUR-032', imageUrl: 'https://example.com/gacha/aurora-weaver.jpg' },
    { name: 'Prism Colossus', rarity: 'EPIC', setCode: 'AUR-041', imageUrl: 'https://example.com/gacha/prism-colossus.jpg' },
    { name: 'Celestial Dragon', rarity: 'LEGENDARY', setCode: 'CEL-001', imageUrl: 'https://example.com/gacha/celestial-dragon.jpg' },
    { name: 'Eclipse Sovereign', rarity: 'LEGENDARY', setCode: 'CEL-009', imageUrl: 'https://example.com/gacha/eclipse-sovereign.jpg' }
  ];

  const gachaCardByName = {};
  for (const cardData of gachaCardsData) {
    const card = await prisma.gachaCard.create({
      data: {
        name: cardData.name,
        slug: `gacha-${cardData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
        rarity: cardData.rarity,
        setCode: cardData.setCode,
        imageUrl: cardData.imageUrl,
        dropRate: 1
      }
    });
    gachaCardByName[cardData.name] = card;
  }
  console.log(`Created ${gachaCardsData.length} gacha cards.`);

  const virtualBoxesData = [
    {
      name: 'Genesis Starter Box',
      slug: 'genesis-starter-box',
      description: 'Entry-level gacha box with a balanced pool of collectible cards.',
      price: 24.99,
      status: 'ACTIVE',
      gradient: 'from-violet-500 to-fuchsia-500',
      dropRates: [
        { rarity: 'COMMON', rate: 60 },
        { rarity: 'RARE', rate: 25 },
        { rarity: 'EPIC', rate: 10 },
        { rarity: 'LEGENDARY', rate: 5 }
      ],
      pool: [
        { name: 'Ember Fox', rarity: 'COMMON' },
        { name: 'Tide Runner', rarity: 'COMMON' },
        { name: 'Stone Sentinel', rarity: 'COMMON' },
        { name: 'Gale Dancer', rarity: 'RARE' },
        { name: 'Aurora Weaver', rarity: 'EPIC' },
        { name: 'Celestial Dragon', rarity: 'LEGENDARY' }
      ]
    },
    {
      name: 'Aurora Legends Box',
      slug: 'aurora-legends-box',
      description: 'Premium box with boosted Epic and Legendary odds.',
      price: 49.99,
      status: 'ACTIVE',
      gradient: 'from-cyan-500 to-blue-600',
      dropRates: [
        { rarity: 'COMMON', rate: 50 },
        { rarity: 'RARE', rate: 30 },
        { rarity: 'EPIC', rate: 14 },
        { rarity: 'LEGENDARY', rate: 6 }
      ],
      pool: [
        { name: 'Tide Runner', rarity: 'COMMON' },
        { name: 'Ember Fox', rarity: 'COMMON' },
        { name: 'Void Wanderer', rarity: 'RARE' },
        { name: 'Prism Colossus', rarity: 'EPIC' },
        { name: 'Eclipse Sovereign', rarity: 'LEGENDARY' }
      ]
    },
    {
      name: 'Obsidian Rivals Box',
      slug: 'obsidian-rivals-box',
      description: 'Upcoming box (draft) reserved for the next release wave.',
      price: 39.99,
      status: 'DRAFT',
      gradient: 'from-slate-600 to-slate-900',
      dropRates: [
        { rarity: 'COMMON', rate: 58 },
        { rarity: 'RARE', rate: 27 },
        { rarity: 'EPIC', rate: 11 },
        { rarity: 'LEGENDARY', rate: 4 }
      ],
      pool: [
        { name: 'Stone Sentinel', rarity: 'COMMON' },
        { name: 'Gale Dancer', rarity: 'RARE' },
        { name: 'Prism Colossus', rarity: 'EPIC' }
      ]
    }
  ];

  for (const boxData of virtualBoxesData) {
    const { dropRates, pool, ...boxFields } = boxData;
    const box = await prisma.virtualBox.create({
      data: {
        ...boxFields,
        dropRates: { create: dropRates },
        poolItems: {
          create: pool.map(entry => ({
            gachaCardId: gachaCardByName[entry.name].id,
            rarity: entry.rarity
          }))
        }
      }
    });
    console.log(`Created virtual box: ${box.name} (${box.status})`);
  }

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