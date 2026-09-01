const { AppError, ValidationError } = require('../utils/errors');

const GACHA_RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

const FLOAT_EPSILON = 1e-6;

// Validate a VirtualBox drop-rate configuration:
// every entry must be a known rarity with a rate in [0, 100], no duplicate
// rarities, and the rates must sum to exactly 100%.
const validateDropRates = (dropRates) => {
  if (!Array.isArray(dropRates) || dropRates.length === 0) {
    throw new ValidationError('Drop rates are required and must not be empty');
  }

  const seen = new Set();
  for (const entry of dropRates) {
    if (!GACHA_RARITIES.includes(entry.rarity)) {
      throw new ValidationError(`Invalid rarity "${entry.rarity}". Allowed: ${GACHA_RARITIES.join(', ')}`);
    }
    if (seen.has(entry.rarity)) {
      throw new ValidationError(`Duplicate drop rate entry for rarity "${entry.rarity}"`);
    }
    seen.add(entry.rarity);

    const rate = Number(entry.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      throw new ValidationError(`Drop rate for "${entry.rarity}" must be a number between 0 and 100`);
    }
  }

  const total = dropRates.reduce((sum, entry) => sum + Number(entry.rate), 0);
  if (Math.abs(total - 100) > FLOAT_EPSILON) {
    throw new ValidationError(`Drop rates must sum to 100% (currently ${total}%)`);
  }

  return dropRates.map((entry) => ({ rarity: entry.rarity, rate: Number(entry.rate) }));
};

// Weighted random selection over a list of { rarity, rate } weights.
// Returns the selected rarity. `rng` is injectable for testing.
const rollRarity = (weights, rng = Math.random) => {
  const totalWeight = weights.reduce((sum, w) => sum + w.rate, 0);
  if (totalWeight <= 0) {
    throw new AppError('No positive drop rates available to roll', 500, 'GACHA_CONFIG_ERROR');
  }

  let roll = rng() * totalWeight;
  for (const { rarity, rate } of weights) {
    roll -= rate;
    if (roll < 0) return rarity;
  }
  // Floating-point guard: return the last positive-weight rarity
  return weights[weights.length - 1].rarity;
};

// Uniform random pick from a non-empty array. `rng` is injectable for testing.
const pickRandom = (items, rng = Math.random) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const index = Math.min(items.length - 1, Math.floor(rng() * items.length));
  return items[index];
};

// Weighted random pick over pool items of one rarity. Each item's weight is
// its GachaCard dropRate when set (> 0), otherwise uniform. `rng` injectable.
const pickWeightedRandom = (items, rng = Math.random) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  const weights = items.map((item) => {
    const rate = Number(item?.gachaCard?.dropRate);
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng() * totalWeight;
  for (let i = 0; i < items.length; i += 1) {
    roll -= weights[i];
    if (roll < 0) return items[i];
  }
  return items[items.length - 1];
};

// Warn at most once per box (per process) about empty-rarity pools
const warnedBoxIds = new Set();

// Roll a card from a VirtualBox.
// `box` must include `dropRates` ({ rarity, rate }[]) and `poolItems`
// ({ id, rarity, gachaCardId, gachaCard: { id, name, imageUrl, rarity,
// setCode, dropRate } }[]).
//
// Steps:
//   1. Validate the configured drop rates sum to 100%.
//   2. Build effective weights from rarities that actually have pool items,
//      redistributing the weight of empty rarities proportionally so an
//      opening never fails at runtime because of a pool gap.
//   3. Roll the rarity (weighted), then pick a pool item of that rarity —
//      weighted by the card's own dropRate when set (fallback: uniform).
const rollCardFromBox = (box, rng = Math.random) => {
  const validated = validateDropRates(box.dropRates);

  const poolByRarity = new Map();
  for (const item of box.poolItems || []) {
    if (!poolByRarity.has(item.rarity)) poolByRarity.set(item.rarity, []);
    poolByRarity.get(item.rarity).push(item);
  }

  const effectiveWeights = validated
    .filter((entry) => (poolByRarity.get(entry.rarity) || []).length > 0)
    .map((entry) => ({ rarity: entry.rarity, rate: entry.rate }));

  if (effectiveWeights.length === 0) {
    throw new AppError('This box has no cards available to pull', 409, 'BOX_POOL_EMPTY');
  }

  const droppedEmpty = validated.filter(
    (entry) => entry.rate > 0 && !(poolByRarity.get(entry.rarity) || []).length
  );
  if (droppedEmpty.length > 0 && !warnedBoxIds.has(box.id)) {
    warnedBoxIds.add(box.id);
    console.warn(
      `[gacha] Box "${box.id}": rarities [${droppedEmpty.map((e) => e.rarity).join(', ')}] have no pool items; their weight is redistributed`
    );
  }

  const rarity = rollRarity(effectiveWeights, rng);
  const poolItem = pickWeightedRandom(poolByRarity.get(rarity), rng);
  if (!poolItem) {
    throw new AppError('This box has no cards available to pull', 409, 'BOX_POOL_EMPTY');
  }

  return { rarity, poolItem };
};

module.exports = {
  GACHA_RARITIES,
  validateDropRates,
  rollRarity,
  pickRandom,
  pickWeightedRandom,
  rollCardFromBox
};
