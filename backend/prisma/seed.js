// prisma/seed.js
// Generated client (custom output) — runs standalone, no @prisma/client needed.
const { PrismaClient } = require('../src/generated/prisma');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

// =============================================================================
// POKÉMON TCG MASTER DATA — canonical taxonomy
// =============================================================================
// Everything below is authentic Pokémon TCG domain data. Legacy cross-game
// mock rows (Yu-Gi-Oh, MTG) and ad-hoc rarity spellings are gone for good:
// the storefront filter rail and category pruning are driven by these rows,
// so a stray non-Pokémon product silently corrupts the facet dropdowns.
// Prices are VND (the shop formats with Intl 'vi-VN' / currency VND).

const TCG_GAME = 'Pokémon TCG';

const RARITY = {
  C: 'Common (C)',
  U: 'Uncommon (U)',
  R: 'Rare (R)',
  RR: 'Double Rare (RR)',
  IR: 'Illustration Rare (IR)',
  SAR: 'Special Illustration Rare (SAR)',
  UR: 'Ultra Rare (UR)',
  HR: 'Hyper Rare (HR)',
  ACE_SPEC: 'ACE SPEC'
};

const LANGUAGE = {
  ENG: 'ENG', // English
  JP: 'JP',   // Japanese
  VIE: 'VIE'  // Vietnamese
};

// Expansion sets — each entry: name, slug, code, releaseDate, parent series.
const SERIES = {
  SV:    { name: 'Scarlet & Violet', slug: 'scarlet-violet' },
  SWSH:  { name: 'Sword & Shield',   slug: 'sword-shield' },
  SM:    { name: 'Sun & Moon',       slug: 'sun-moon' }
};
const SERIES_BY_SLUG = {
  'scarlet-violet': SERIES.SV,
  'sword-shield': SERIES.SWSH,
  'sun-moon': SERIES.SM
};

// Every expansion is attached to its CORRECT series. Paldea Evolved is part
// of the Scarlet & Violet main series and backs the "Iono Full Art" sample —
// the same set carries the English Paldea Evolved print (269/193).
const EXPANSIONS = [
  { series: SERIES.SV,   name: '151 (MEW)',            slug: 'sv-151',              code: 'MEW',  releaseDate: new Date('2023-09-22'), printedTotal: 165 },
  { series: SERIES.SV,   name: 'Paldean Fates (PAF)',  slug: 'sv-paldean-fates',    code: 'PAF',  releaseDate: new Date('2024-03-29'), printedTotal: 91  },
  { series: SERIES.SV,   name: 'Obsidian Flames (OBF)', slug: 'sv-obsidian-flames', code: 'OBF',  releaseDate: new Date('2023-08-11'), printedTotal: 197 },
  { series: SERIES.SV,   name: 'Surging Sparks (SSP)', slug: 'sv-surging-sparks',   code: 'SSP',  releaseDate: new Date('2024-11-08'), printedTotal: 191 },
  { series: SERIES.SV,   name: 'Paldea Evolved (PECO)', slug: 'sv-paldea-evolved',  code: 'PECO', releaseDate: new Date('2023-06-09'), printedTotal: 193 },
  { series: SERIES.SWSH, name: 'Crown Zenith (CRZ)',   slug: 'swsh-crown-zenith',   code: 'CRZ',  releaseDate: new Date('2023-01-20'), printedTotal: 197 },
  { series: SERIES.SWSH, name: 'Evolving Skies (EVS)', slug: 'swsh-evolving-skies', code: 'EVS',  releaseDate: new Date('2021-08-27'), printedTotal: 203 },
  { series: SERIES.SWSH, name: 'Lost Origin (LOR)',    slug: 'swsh-lost-origin',    code: 'LOR',  releaseDate: new Date('2022-09-09'), printedTotal: 196 },
  { series: SERIES.SM,   name: 'Cosmic Eclipse (MMA9)', slug: 'sm-cosmic-eclipse',  code: 'MMA9', releaseDate: new Date('2019-11-29'), printedTotal: 236 }
];

// Sealed product types (`sealed_type`) — level-2 categories under Sealed Products.
const SEALED_TYPES = [
  { name: 'Booster Box', slug: 'booster-box' },
  { name: 'Elite Trainer Box (ETB)', slug: 'elite-trainer-box' },
  { name: 'Booster Pack', slug: 'booster-pack' },
  { name: 'Special Collection Box', slug: 'special-collection-box' },
  { name: 'Tin Box', slug: 'tin-box' }
];

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function main() {
  // =========================================================================
  // IDEMPOTENCY GUARD — this seed runs on every deploy.
  // If the database already contains data (users/products/orders), exit
  // immediately WITHOUT deleting anything. A redeploy must never wipe data —
  // this is what keeps primary keys free of collisions and live stock intact.
  // To force a fresh Pokémon TCG master-data reseed, run with SEED_FORCE=1
  // (destructive — wipes in FK-safe order, then repopulates).
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
    console.log('Empty database detected — seeding Pokémon TCG master data...');
  } else {
    console.log('SEED_FORCE is set — wiping and reseeding Pokémon TCG master data...');
  }

  if (forceSeed) {
    console.log('Cleaning existing data (FK-safe order, no orphans left behind)...');

    // Delete in dependency-safe order: children before parents. Voucher is
    // referenced by Order (SET NULL) AND UserVoucher (CASCADE) — clear both
    // join/usage tables before the voucher and product masters.
    await prisma.orderStatusHistory.deleteMany({});
    await prisma.paymentLog.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.post.deleteMany({}); // Posts reference User.authorId with Restrict
    await prisma.card.deleteMany({});
    await prisma.productVariant.deleteMany({});
    await prisma.userCard.deleteMany({});
    await prisma.virtualBoxOpening.deleteMany({});
    await prisma.virtualBoxPoolItem.deleteMany({});
    await prisma.virtualBoxDropRate.deleteMany({});
    await prisma.virtualBox.deleteMany({});
    await prisma.gachaCard.deleteMany({});
    await prisma.userVoucher.deleteMany({});
    await prisma.voucher.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.set.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.refreshToken.deleteMany({});
    await prisma.passwordResetToken.deleteMany({});
    await prisma.appSetting.deleteMany({});
    await prisma.user.deleteMany({});
  }

  // ─────────────────────────────────────────────────────────────────────────
  // USERS
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Creating users...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@tcg.com';
  const adminPassword = await hashPassword(process.env.ADMIN_PASSWORD || 'Admin@123');
  const staffPassword = await hashPassword('Staff@123');
  const customerPassword = await hashPassword('Customer@123');

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: adminPassword,
      fullName: 'Admin User',
      phone: '84900000001',
      address: '1 Admin St, Hanoi',
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerified: true,
      canManageInventory: true,
      canManagePosts: true
    }
  });

  const staff = await prisma.user.create({
    data: {
      email: 'staff@tcg.com',
      passwordHash: staffPassword,
      fullName: 'Staff User',
      phone: '84900000002',
      address: '2 Staff St, Hanoi',
      role: 'STAFF',
      status: 'ACTIVE',
      emailVerified: true,
      canManageInventory: true,
      canManagePosts: true
    }
  });

  const customer = await prisma.user.create({
    data: {
      email: 'customer@tcg.com',
      passwordHash: customerPassword,
      fullName: 'Customer User',
      phone: '84900000003',
      address: '3 Customer St, Hanoi',
      role: 'CUSTOMER',
      status: 'ACTIVE',
      emailVerified: true,
      balance: 100 // demo balance for gacha openings
    }
  });

  console.log(`Created users: ${admin.email}, ${staff.email}, ${customer.email}`);

  // ─────────────────────────────────────────────────────────────────────────
  // CATEGORY TREE  (Single Cards → series → expansion · Sealed Products → sealed_type)
  // ─────────────────────────────────────────────────────────────────────────
  // Level 1 roots: every product is either a Sealed Product or a Single Card
  // (plus an Accessories bucket). Series/Eras hang under Single Cards, their
  // expansion sets hang under the series. Sealed product types hang directly
  // under Sealed Products. Language/rarity are Product attributes, NEVER
  // categories — the storefront prunes category nodes with 0 ACTIVE products,
  // so a fully seeded empty series (e.g. Sun & Moon) simply does not show as
  // a filter until stock exists.
  console.log('Creating category tree...');

  const cardCategory = await prisma.category.create({
    data: {
      name: 'Single Cards',
      slug: 'single-cards',
      description: 'Authenticated Pokémon TCG singles and chase cards',
      isActive: true
    }
  });

  const boxCategory = await prisma.category.create({
    data: {
      name: 'Sealed Products',
      slug: 'sealed-products',
      description: 'Sealed Pokémon TCG booster boxes, ETBs, tins and special collections',
      isActive: true
    }
  });

  const accessoriesCategory = await prisma.category.create({
    data: {
      name: 'Accessories',
      slug: 'accessories',
      description: 'Card sleeves, binders, deck boxes and playmats',
      isActive: true
    }
  });

  const createChild = async (parentId, name, slug, description = null) =>
    prisma.category.create({ data: { name, slug, description, parentId, isActive: true } });

  // Single Cards → series/eras
  const seriesCatBySlug = {};
  for (const series of Object.values(SERIES_BY_SLUG)) {
    seriesCatBySlug[series.slug] = await createChild(
      cardCategory.id,
      series.name,
      series.slug,
      `${series.name} era`
    );
  }

  // ... → expansion sets
  const setCatBySlug = {};
  for (const expansion of EXPANSIONS) {
    setCatBySlug[expansion.slug] = await createChild(
      seriesCatBySlug[expansion.series.slug].id,
      expansion.name,
      expansion.slug,
      `${expansion.series.name} — ${expansion.name} expansion`
    );
  }

  // Sealed Products → sealed types
  const sealedTypeCatBySlug = {};
  for (const type of SEALED_TYPES) {
    sealedTypeCatBySlug[type.slug] = await createChild(boxCategory.id, type.name, type.slug);
  }

  // Accessories → types
  await createChild(accessoriesCategory.id, 'Sleeves', 'sleeves');
  await createChild(accessoriesCategory.id, 'Binders', 'binders');
  await createChild(accessoriesCategory.id, 'Deck Boxes', 'deck-boxes');
  await createChild(accessoriesCategory.id, 'Toploaders', 'toploaders');
  await createChild(accessoriesCategory.id, 'Playmats', 'playmats');

  console.log('Created hierarchical category tree: 3 roots × series/types → expansion sets.');

  // ─────────────────────────────────────────────────────────────────────────
  // SETS (catalogue expansions — powers ?set=SSP style filtering)
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Creating expansion sets...');

  const setBySlug = {};
  for (const expansion of EXPANSIONS) {
    setBySlug[expansion.slug] = await prisma.set.create({
      data: {
        name: expansion.name,
        slug: expansion.slug,
        code: expansion.code,
        releaseDate: expansion.releaseDate,
        description: `Pokémon TCG — ${expansion.name}, ${expansion.series.name} expansion (${expansion.printedTotal} numbered cards).`
      }
    });
  }
  console.log(`Created ${EXPANSIONS.length} sets: ${EXPANSIONS.map((e) => e.code).join(', ')}.`);

  // ─────────────────────────────────────────────────────────────────────────
  // PRODUCTS — authentic Pokémon TCG sample catalogue
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Creating products...');

  const productsData = [
    // ---- Single Cards ----
    {
      type: 'card',
      name: 'Charizard ex 199/165 SAR',
      shortName: 'Charizard ex SAR',
      slug: 'charizard-ex-199-sar-eng',
      description: 'Charizard ex — Special Illustration Rare (SAR), 199/165 from Scarlet & Violet 151 (English). Full-art chase card of the 151\'s secret-rare lineup.',
      categorySlug: 'sv-151',
      setSlug: 'sv-151',
      cardNumber: '199/165',
      rarity: RARITY.SAR,
      language: LANGUAGE.ENG,
      cardSet: '151 (MEW)',
      artist: 'miki kudo',
      condition: 'NEAR_MINT',
      price: 8990000,
      stockQuantity: 2,
      images: ['https://images.pokemontcg.io/sv2a/199.png'],
      attributes: { game: TCG_GAME, series: SERIES.SV.name, code: 'MEW', holo: true, secretNumber: true, numberInSet: 199, setTotal: 165 }
    },
    {
      type: 'card',
      name: 'Pikachu ex SAR 238/191 (Surging Sparks)',
      shortName: 'Pikachu ex SAR',
      slug: 'pikachu-ex-238-sar-eng',
      description: 'Pikachu ex — Special Illustration Rare (SAR), 238/191 from Surging Sparks (English). The definitive Pikachu chase card of the Scarlet & Violet era.',
      categorySlug: 'sv-surging-sparks',
      setSlug: 'sv-surging-sparks',
      cardNumber: '238/191',
      rarity: RARITY.SAR,
      language: LANGUAGE.ENG,
      cardSet: 'Surging Sparks (SSP)',
      artist: 'GIDORA',
      condition: 'NEAR_MINT',
      price: 7450000,
      stockQuantity: 2,
      images: ['https://images.pokemontcg.io/sv8/238.png'],
      attributes: { game: TCG_GAME, series: SERIES.SV.name, code: 'SSP', holo: true, secretNumber: true, numberInSet: 238, setTotal: 191 }
    },
    {
      type: 'card',
      name: 'Iono Supporter Full Art 269/193 SIR',
      shortName: 'Iono Full Art',
      slug: 'iono-269-sir-eng',
      description: 'Iono — Special Illustration Rare full-art Supporter, 269/193 from Paldea Evolved (English). One of the most played competitive Supporters of the era.',
      categorySlug: 'sv-paldea-evolved',
      setSlug: 'sv-paldea-evolved',
      cardNumber: '269/193',
      rarity: RARITY.SAR,
      language: LANGUAGE.ENG,
      cardSet: 'Paldea Evolved (PECO)',
      artist: 'kirisAki',
      condition: 'NEAR_MINT',
      price: 1290000,
      stockQuantity: 3,
      images: ['https://images.pokemontcg.io/sv2/269.png'],
      attributes: { game: TCG_GAME, series: SERIES.SV.name, code: 'PECO', holo: true, secretNumber: true, cardType: 'Trainer — Supporter', numberInSet: 269, setTotal: 193 }
    },
    {
      type: 'card',
      name: 'Mew ex 151/165 (Double Rare)',
      shortName: 'Mew ex',
      slug: 'mew-ex-151-rar-eng',
      description: 'Mew ex — Double Rare (RR), 151/165 from Scarlet & Violet 151 (English). The iconic 151 mascot card.',
      categorySlug: 'sv-151',
      setSlug: 'sv-151',
      cardNumber: '151/165',
      rarity: RARITY.RR,
      language: LANGUAGE.ENG,
      cardSet: '151 (MEW)',
      artist: 'aky CG Works',
      condition: 'NEAR_MINT',
      price: 210000,
      stockQuantity: 3,
      images: ['https://images.pokemontcg.io/sv2a/151.png'],
      attributes: { game: TCG_GAME, series: SERIES.SV.name, code: 'MEW', holo: true, numberInSet: 151, setTotal: 165 }
    },
    // ---- Sealed Products (variant: language + version, simplified stock) ----
    {
      type: 'sealed',
      name: 'Pokémon TCG: Scarlet & Violet 151 Elite Trainer Box (ENG)',
      shortName: '151 ETB',
      slug: 'sv-151-elite-trainer-box-eng',
      description: 'Pokémon TCG: Scarlet & Violet—151 Elite Trainer Box (English). Sealed ETB with booster packs, promo card and trainer accessories.',
      sealedTypeSlug: 'elite-trainer-box',
      setSlug: 'sv-151',
      language: LANGUAGE.ENG,
      cardSet: '151 (MEW)',
      condition: 'MINT',
      price: 1850000,
      stockQuantity: 6,
      images: ['https://images.pokemontcg.io/sv2a_supplies.png'],
      attributes: { game: TCG_GAME, sealedType: 'Elite Trainer Box (ETB)', series: SERIES.SV.name, code: 'MEW' }
    },
    {
      type: 'sealed',
      name: 'Pokémon Card 151 Shiny Treasure ex Booster Box (JP)',
      shortName: 'Shiny Treasure ex Box',
      slug: 'shiny-treasure-ex-booster-box-jp',
      description: 'Japanese Shiny Treasure ex booster box (SV2D-side special subset; English release: Paldean Fates). Sealed 日本語 product for JP collectors.',
      sealedTypeSlug: 'booster-box',
      setSlug: 'sv-paldean-fates',
      language: LANGUAGE.JP,
      cardSet: 'Paldean Fates (PAF)',
      condition: 'MINT',
      price: 3450000,
      stockQuantity: 3,
      images: ['https://images.pokemontcg.io/sv3pt5_supplies.png'],
      attributes: { game: TCG_GAME, sealedType: 'Booster Box', series: SERIES.SV.name, code: 'SV3P5' }
    },
    {
      type: 'sealed',
      name: 'Pokémon TCG: Scarlet & Violet 151 Booster Box (VIE)',
      shortName: '151 Booster Box VIE',
      slug: 'sv-151-booster-box-vie',
      description: 'Hộp booster Pokémon TCG: Scarlet & Violet—151 bản Tiếng Việt (VIE) — hàng niêm phong chính hãng, 36 gói.',
      sealedTypeSlug: 'booster-box',
      setSlug: 'sv-151',
      language: LANGUAGE.VIE,
      cardSet: '151 (MEW)',
      condition: 'MINT',
      price: 2650000,
      stockQuantity: 5,
      images: ['https://images.pokemontcg.io/sv2a_supplies.png'],
      attributes: { game: TCG_GAME, sealedType: 'Booster Box', packs: 36, series: SERIES.SV.name, code: 'MEW' }
    }
  ];

  const createdProducts = [];
  for (const productData of productsData) {
    const leafSlug = productData.type === 'card' ? productData.categorySlug : productData.sealedTypeSlug;
    const {
      type, categorySlug, sealedTypeSlug, setSlug,
      condition, price, stockQuantity, ...rest
    } = productData;

    const product = await prisma.product.create({
      data: {
        ...rest,
        rarity: type === 'card' ? productData.rarity : null,
        category: { connect: { id: setCatBySlug[leafSlug]?.id || sealedTypeCatBySlug[leafSlug]?.id || cardCategory.id } },
        sets: setSlug ? { connect: { id: setBySlug[setSlug].id } } : undefined
      }
    });
    createdProducts.push(product);
    console.log(`Created product: ${product.name}`);

    // condition / price / stockQuantity belong to ProductVariant, not Product.
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        condition: condition || 'NEAR_MINT',
        variant: type === 'card' ? productData.language : 'Normal',
        price: price != null ? price : 0,
        stockQuantity: stockQuantity != null ? stockQuantity : 0,
        status: 'ACTIVE'
      }
    });

    // Real single cards are individually serialised (one Card row per copy).
    if (type === 'card') {
      const code = productData.attributes.code || 'TCG';
      for (let i = 1; i <= Math.min(stockQuantity, 3); i++) {
        await prisma.card.create({
          data: {
            sku: `PKM-${code}-${productData.cardNumber.replace('/', '-')}-${productData.language}-0${i}`,
            productId: product.id,
            condition,
            status: 'AVAILABLE',
            purchasePrice: Math.round(price * 0.75),
            notes: 'Verified Pokémon TCG single — seeded stock'
          }
        });
      }
    }
  }

  console.log(`Created ${productsData.length} products (${productsData.filter((p) => p.type === 'card').length} singles + ${productsData.filter((p) => p.type === 'sealed').length} sealed).`);

  // ─────────────────────────────────────────────────────────────────────────
  // GACHA (virtual boxes) — decoupled Pokémon-themed pool
  // ─────────────────────────────────────────────────────────────────────────
  console.log('Creating gacha cards and virtual boxes (Pokémon-themed)...');

  const gachaCardsData = [
    { name: 'Bulbasaur', rarity: 'COMMON', setCode: 'GEN-001', imageUrl: 'https://images.pokemontcg.io/base1/46.png' },
    { name: 'Charmander', rarity: 'COMMON', setCode: 'GEN-004', imageUrl: 'https://images.pokemontcg.io/base1/4.png' },
    { name: 'Squirtle', rarity: 'COMMON', setCode: 'GEN-007', imageUrl: 'https://images.pokemontcg.io/base1/65.png' },
    { name: 'Raichu', rarity: 'RARE', setCode: 'GEN-026', imageUrl: 'https://images.pokemontcg.io/base1/48.png' },
    { name: 'Gengar', rarity: 'RARE', setCode: 'GEN-094', imageUrl: 'https://images.pokemontcg.io/base1/15.png' },
    { name: 'Lapras ex', rarity: 'EPIC', setCode: 'MEW-066', imageUrl: 'https://images.pokemontcg.io/sv2a/79.png' },
    { name: 'Gardevoir ex', rarity: 'EPIC', setCode: 'SV1-086', imageUrl: 'https://images.pokemontcg.io/sv1/86.png' },
    { name: 'Mew ex', rarity: 'LEGENDARY', setCode: 'MEW-151', imageUrl: 'https://images.pokemontcg.io/sv2a/151.png' },
    { name: 'Charizard ex', rarity: 'LEGENDARY', setCode: 'MEW-199', imageUrl: 'https://images.pokemontcg.io/sv2a/199.png' }
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
      name: 'Kanto Starter Box',
      slug: 'kanto-starter-box',
      description: 'Entry-level virtual box with a balanced pool of classic Pokémon.',
      price: 300000,
      status: 'ACTIVE',
      gradient: 'from-violet-500 to-fuchsia-500',
      dropRates: [
        { rarity: 'COMMON', rate: 60 },
        { rarity: 'RARE', rate: 25 },
        { rarity: 'EPIC', rate: 10 },
        { rarity: 'LEGENDARY', rate: 5 }
      ],
      pool: [
        { name: 'Bulbasaur', rarity: 'COMMON' },
        { name: 'Charmander', rarity: 'COMMON' },
        { name: 'Squirtle', rarity: 'COMMON' },
        { name: 'Raichu', rarity: 'RARE' },
        { name: 'Lapras ex', rarity: 'EPIC' },
        { name: 'Mew ex', rarity: 'LEGENDARY' }
      ]
    },
    {
      name: 'ex Legends Box',
      slug: 'ex-legends-box',
      description: 'Premium box with boosted Epic and Legendary odds — chase the 151 icons.',
      price: 599000,
      status: 'ACTIVE',
      gradient: 'from-cyan-500 to-blue-600',
      dropRates: [
        { rarity: 'COMMON', rate: 50 },
        { rarity: 'RARE', rate: 30 },
        { rarity: 'EPIC', rate: 14 },
        { rarity: 'LEGENDARY', rate: 6 }
      ],
      pool: [
        { name: 'Charmander', rarity: 'COMMON' },
        { name: 'Raichu', rarity: 'RARE' },
        { name: 'Gengar', rarity: 'RARE' },
        { name: 'Gardevoir ex', rarity: 'EPIC' },
        { name: 'Charizard ex', rarity: 'LEGENDARY' }
      ]
    },
    {
      name: 'Moonbreon Tribute Box',
      slug: 'moonbreon-tribute-box',
      description: 'Upcoming box (draft) reserved for the next release wave.',
      price: 450000,
      status: 'DRAFT',
      gradient: 'from-slate-600 to-slate-900',
      dropRates: [
        { rarity: 'COMMON', rate: 58 },
        { rarity: 'RARE', rate: 27 },
        { rarity: 'EPIC', rate: 11 },
        { rarity: 'LEGENDARY', rate: 4 }
      ],
      pool: [
        { name: 'Bulbasaur', rarity: 'COMMON' },
        { name: 'Gengar', rarity: 'RARE' },
        { name: 'Mew ex', rarity: 'LEGENDARY' }
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
          create: pool.map((entry) => ({
            gachaCardId: gachaCardByName[entry.name].id,
            rarity: entry.rarity
          }))
        }
      }
    });
    console.log(`Created virtual box: ${box.name} (${box.status})`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // POST-SEED INVARIANTS — fail loudly rather than shipping corrupt master
  // data: every Pokémon product must resolve to a Pokémon leaf category, and
  // no cross-game leftovers may exist under any category.
  // ─────────────────────────────────────────────────────────────────────────
  const [totalProducts, nonPokemon, orphanProducts] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({
      where: {
        OR: [
          { name: { contains: 'Dragon' } },
          { slug: { in: ['blue-eyes-white-dragon', 'dark-magician', 'ragavan-nimble-pilferer', 'modern-horizons-2-booster-box'] } },
          { cardSet: { in: ['Legend of Blue Eyes White Dragon', 'Modern Horizons 2'] } }
        ]
      }
    }),
    prisma.product.count({ where: { categoryId: null } })
  ]);
  if (nonPokemon > 0) throw new Error(`Seed invariant failed: ${nonPokemon} non-Pokémon product(s) created.`);
  if (orphanProducts > 0) throw new Error(`Seed invariant failed: ${orphanProducts} product(s) without category (would orphan filter tree).`);
  if (totalProducts !== productsData.length) throw new Error(`Seed invariant failed: expected ${productsData.length} products, found ${totalProducts}.`);

  console.log('Database seeded successfully — Pokémon TCG master data verified.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
