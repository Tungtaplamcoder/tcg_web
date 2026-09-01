/**
 * ══════════════════════════════════════════════════════════════════════
 * AUTOMATIC DATA PARSER SYSTEM — TCG-agnostic product intelligence
 * ══════════════════════════════════════════════════════════════════════
 *
 * Turns any product record (Pokémon, Yu-Gi-Oh!, MTG, One Piece … and
 * anything else the DB grows) into three normalized structures:
 *
 *   1. `parseProductType(product)`   → 'CARD' | 'BOX' | null
 *   2. `parseSpecs(product)`         → [{ key, label, value, icon? }]
 *      A generic key-value matrix that never hardcodes one franchise:
 *      it merges typed columns → attributes JSON → structured lines found
 *      inside the description ("Card Number / Rarity: 157/128 / Futuristic
 *      Rare" becomes two clean specs) and normalizes known aliases
 *      (hp, atk, def, stage, packs, packsPerBox …) into readable labels.
 *   3. `parseAttacks(product)`       → [{ name, costTokens, damage, text }]
 *      Detects structured arrays first (`attributes.attacks`,
 *      `attributes.abilities`) then falls back to regex mining of the
 *      description for energy/cost brackets like `[PP]`, `[1][G][R]`,
 *      `[Fire][Fire]` or Yu-Gi-Oh! style "1900/2500".
 *
 * Every export is a pure function — safe to unit-test and to memoize.
 */

/* ────────────────────────────────────────────────────────────────
   Product type detection — CARD vs BOX (sealed product)
   ──────────────────────────────────────────────────────────────── */

const BOX_HINTS = [
  'box', 'booster box', 'booster bundle', 'display', 'case',
  'sealed', 'elite trainer', 'etb', 'tin', 'bundle', 'booster pack',
  'pack', 'collection', 'starter deck', 'structure deck', 'duel deck',
  'booster', 'trainer box', 'playset', 'prerelease', 'gift set'
];

const norm = (s) => String(s ?? '').toLowerCase().trim();

/** Safe string coercion — null/undefined/objects become ''.
 *  Also repairs mojibake artifacts (latin1→UTF8 loss) where é and
 *  other accents collapsed to '?', e.g. "Pok?mon" → "Pokémon". */
const MOJIBAKE_FIXES = [
  [/Pok\?mon/gi, 'Pokémon']
];

const repairEncoding = (str) => {
  let out = str;
  for (const [re, fix] of MOJIBAKE_FIXES) out = out.replace(re, fix);
  return out;
};

const safeStr = (v) => {
  if (v === null || v === undefined) return '';
  return repairEncoding(String(v));
};

/** Safe array — null/undefined/non-array values become [] */
const safeArr = (v) => (Array.isArray(v) ? v : []);

/** Safe object — null/undefined/array/scalars become {} */
const safeObj = (v) =>
  (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};

const looksLikeBoxName = (name) => {
  const n = norm(name);
  return BOX_HINTS.some((h) => n === h || n.includes(h));
};

/**
 * Resolve the product's binary type. Priority:
 *   1. explicit `attributes.type` (e.g. { type: 'box' })
 *   2. category row (slug/name "box" / "card" — the backend binary)
 *   3. `tags` array membership
 *   4. heuristics: box-flavored name, or card columns absent
 */
/** Repair mojibake in product display fields (names, descriptions) */
export const repairProductEncoding = (product) => {
  if (!product || typeof product !== 'object') return product;
  const out = { ...product };
  if (typeof out.name === 'string') out.name = repairEncoding(out.name);
  if (typeof out.shortName === 'string') out.shortName = repairEncoding(out.shortName);
  if (typeof out.description === 'string') out.description = repairEncoding(out.description);
  return out;
};

export const parseProductType = (product) => {
  if (!product) return null;

  const attrType = norm(product.attributes?.type);
  if (attrType === 'box' || attrType === 'sealed' || attrType === 'sealedbox') return 'BOX';
  if (attrType === 'card' || attrType === 'single' || attrType === 'singlecard') return 'CARD';

  const cat = product.category;
  const catKey = norm(cat?.slug || cat?.name);
  if (catKey.includes('box') || catKey.includes('sealed')) return 'BOX';
  if (catKey.includes('card') || catKey.includes('single')) return 'CARD';

  if (Array.isArray(product.tags)) {
    const tagKeys = product.tags.map((t) => norm(typeof t === 'string' ? t : t?.name || t?.slug));
    if (tagKeys.some((t) => t.includes('box') || t.includes('sealed'))) return 'BOX';
    if (tagKeys.some((t) => t.includes('card'))) return 'CARD';
  }

  if (looksLikeBoxName(product.name) || looksLikeBoxName(product.shortName)) return 'BOX';

  // Single cards almost always carry a card number / rarity;
  // boxes usually describe pack counts instead.
  if (product.cardNumber || product.rarity) return 'CARD';
  return null;
};

export const isBoxProduct = (product) => parseProductType(product) === 'BOX';
export const isCardProduct = (product) => parseProductType(product) === 'CARD';

/* ────────────────────────────────────────────────────────────────
   Franchise detection — drives energy icon mapping
   ──────────────────────────────────────────────────────────────── */

const FRANCHISE_HINTS = [
  { id: 'pokemon', label: 'Pokémon', keywords: ['pokémon', 'pokemon', 'pokedex', 'hp', 'stage', 'retreat', 'energy', 'weakness'] },
  { id: 'yugioh', label: 'Yu-Gi-Oh!', keywords: ['yu-gi-oh', 'yugioh', 'atk', 'def', 'monster', 'spell', 'trap', 'fusion', 'synchro'] },
  { id: 'mtg', label: 'Magic: The Gathering', keywords: ['magic', 'mtg', 'mana', 'planeswalker', 'sorcery', 'instant', 'tap'] },
  { id: 'onepiece', label: 'One Piece', keywords: ['one piece', 'onepiece', 'don', 'rarity', 'op-'] }
];

export const detectFranchise = (product) => {
  const haystack = [
    product?.name,
    product?.shortName,
    product?.description,
    ...safeArr(product?.sets).map((s) => s?.name),
    product?.category?.name
  ].map(norm).join(' ');

  for (const f of FRANCHISE_HINTS) {
    if (f.keywords.some((k) => haystack.includes(k))) return f;
  }
  return { id: 'generic', label: null, keywords: [] };
};

/* ────────────────────────────────────────────────────────────────
   Spec extraction — generic key/value matrix
   ──────────────────────────────────────────────────────────────── */

/** Alias table: raw field name (normalized) → pretty label */
const SPEC_ALIASES = {
  cardnumber: { label: 'Card Number', icon: 'Hash' },
  number: { label: 'Card Number', icon: 'Hash' },
  no: { label: 'Card Number', icon: 'Hash' },
  rarity: { label: 'Rarity', icon: 'Gem' },
  artist: { label: 'Artist', icon: 'Brush' },
  illustrator: { label: 'Artist', icon: 'Brush' },
  hp: { label: 'HP', icon: 'HeartPulse' },
  stage: { label: 'Stage', icon: 'Layers' },
  evolvesfrom: { label: 'Evolves From', icon: 'GitBranch' },
  evolves: { label: 'Evolves From', icon: 'GitBranch' },
  retreatcost: { label: 'Retreat Cost', icon: 'Footprints' },
  retreat: { label: 'Retreat Cost', icon: 'Footprints' },
  weak: { label: 'Weakness', icon: 'TrendingDown' },
  weakness: { label: 'Weakness', icon: 'TrendingDown' },
  resist: { label: 'Resistance', icon: 'TrendingUp' },
  resistance: { label: 'Resistance', icon: 'TrendingUp' },
  atk: { label: 'ATK', icon: 'Swords' },
  attack: { label: 'ATK', icon: 'Swords' },
  def: { label: 'DEF', icon: 'Shield' },
  defense: { label: 'DEF', icon: 'Shield' },
  attributetype: { label: 'Attribute', icon: 'Sparkles' },
  attribute: { label: 'Attribute', icon: 'Sparkles' },
  monstertype: { label: 'Monster Type', icon: 'Layers' },
  cardtype: { label: 'Card Type', icon: 'Layers' },
  type: { label: 'Type', icon: 'Sparkles' },
  energytype: { label: 'Energy', icon: 'Zap' },
  energy: { label: 'Energy', icon: 'Zap' },
  color: { label: 'Color', icon: 'Palette' },
  colors: { label: 'Colors', icon: 'Palette' },
  coloridentity: { label: 'Color Identity', icon: 'Palette' },
  mana: { label: 'Mana Cost', icon: 'Zap' },
  manacost: { label: 'Mana Cost', icon: 'Zap' },
  set: { label: 'Set', icon: 'Package' },
  setname: { label: 'Set', icon: 'Package' },
  setcode: { label: 'Set Code', icon: 'Package' },
  expansion: { label: 'Set', icon: 'Package' },
  pack: { label: 'Packs per Box', icon: 'Package' },
  packs: { label: 'Packs per Box', icon: 'Package' },
  packsperbox: { label: 'Packs per Box', icon: 'Package' },
  cardsperpack: { label: 'Cards per Pack', icon: 'Layers' },
  cardsperbox: { label: 'Cards per Box', icon: 'Layers' },
  boxcontents: { label: 'Box Contents', icon: 'Package' },
  releaseyear: { label: 'Release Year', icon: 'Calendar' },
  releasedate: { label: 'Release Date', icon: 'Calendar' },
  year: { label: 'Release Year', icon: 'Calendar' },
  language: { label: 'Language', icon: 'Languages' },
  finish: { label: 'Finish', icon: 'Sparkles' },
  legalities: { label: 'Format Legality', icon: 'Scale' },
  setseries: { label: 'Series', icon: 'Package' }
};

const isBlank = (v) =>
  v === null || v === undefined || v === '' ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);

const prettyValue = (v) => {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(prettyValue).filter(Boolean).join(', ');
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') {
    // { fire: 2, water: 1 } → "Fire ×2, Water ×1"
    return Object.entries(safeObj(v))
      .map(([k, n]) => (typeof n === 'number' && n > 1 ? `${k} ×${n}` : k))
      .join(', ');
  }
  return safeStr(v).trim();
};

/** Normalize a raw key into { label, icon } via the alias table. */
const resolveSpecMeta = (rawKey) => {
  const key = norm(rawKey).replace(/[_\s-]+/g, '');
  const hit = SPEC_ALIASES[key];
  if (hit) return hit;
  const words = norm(rawKey).replace(/[_-]+/g, ' ').split(/\s+/).filter(Boolean);
  return {
    label: words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Detail',
    icon: null
  };
};

/**
 * Structured-text mining. Descriptions often carry legacy lines like:
 *   "Card Number / Rarity: 157/128 / Futuristic Rare"
 *   "HP / Stage: 130 / Stage 2"
 *   "ATK / DEF: 1900 / 2500"
 * Each "/"-separated key group maps onto the value group 1:1; multi-word
 * segments map to the joined value so nothing is lost.
 */
const SPEC_LINE_RE = /^\s*([A-Za-z][A-Za-z0-9 /()&.'-]{1,48}?)\s*[:：]\s*(.+?)\s*$/;

const splitSlashParts = (s) => safeStr(s)
  .split(/\s+\/\s*(?![^[]*\])/) // don't split inside energy brackets [G/R]
  .map((p) => p.trim())
  .filter(Boolean);

export const parseStructuredLines = (text) => {
  const out = [];
  if (!text || typeof text !== 'string') return out;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = safeStr(rawLine).replace(/^[-•*·]\s*/, '').trim();
    if (!line) continue;
    const m = line.match(SPEC_LINE_RE);
    if (!m || !m[1] || !m[2]) continue;
    const keys = splitSlashParts(m[1]).map(resolveSpecMeta);
    const values = splitSlashParts(m[2]);
    if (keys.length === 0 || values.length === 0) continue;
    if (values.length === keys.length) {
      keys.forEach((meta, i) => out.push({ rawKey: meta.label, label: meta.label, icon: meta.icon, value: values[i] }));
    } else {
      // N keys, one joined value (or vice versa) — keep the full pairing
      keys.forEach((meta, i) => out.push({
        rawKey: meta.label,
        label: meta.label,
        icon: meta.icon,
        value: values.length === 1 ? m[2].trim() : values[Math.min(i, values.length - 1)]
      }));
    }
  }
  return out;
};

/** Keys consumed by the typed columns so attributes never duplicate them */
const COLUMN_KEYS = new Set(['cardnumber', 'rarity', 'artist', 'set']);

/** Keys never rendered as spec badges (attacks/abilities become cards) */
const STRUCTURED_BLOCK_KEYS = new Set(['attacks', 'abilities', 'effects', 'rules', 'legacyprice', 'type']);

/**
 * Build the generic spec matrix for a product.
 * Order matters: typed DB columns are authoritative, then attributes JSON,
 * then structured description lines — first occurrence of a label wins.
 */
export const parseSpecs = (product, productType = null) => {
  if (!product || typeof product !== 'object') return [];
  const type = productType || parseProductType(product);
  const specs = [];
  const seen = new Set();
  const push = (rawKey, value, forcedIcon) => {
    if (isBlank(value)) return;
    const meta = resolveSpecMeta(rawKey);
    const dedupeKey = norm(meta.label).replace(/\s+/g, '');
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    specs.push({
      key: dedupeKey,
      label: meta.label,
      icon: forcedIcon || meta.icon,
      value: prettyValue(value)
    });
  };

  /* 1. Typed columns */
  if (product.cardNumber) push('cardNumber', product.cardNumber);
  if (product.rarity) push('rarity', product.rarity);
  if (product.artist) push('artist', product.artist);
  const sets = safeArr(product.sets);
  if (sets.length) push('setName', sets.map((s) => s?.name).filter(Boolean).join(', '));
  const attrs = safeObj(product.attributes);
  if (type !== 'BOX') {
    if (attrs.hp) push('hp', attrs.hp);
    if (attrs.stage) push('stage', attrs.stage);
  }

  /* 2. attributes JSON (generic — any franchise key flows through) */
  for (const [k, v] of Object.entries(attrs)) {
    if (STRUCTURED_BLOCK_KEYS.has(norm(k))) continue;
    if (type === 'BOX' && ['hp', 'stage', 'weakness', 'resistance', 'retreatcost', 'atk', 'def'].includes(norm(k).replace(/[_\s-]/g, ''))) continue;
    if (COLUMN_KEYS.has(norm(k).replace(/[_\s-]/g, '')) && product[norm(k).replace(/[_\s-]/g, '')]) continue;
    push(k, v);
  }

  /* 3. Structured description lines */
  for (const parsed of parseStructuredLines(product.description)) {
    if (type === 'BOX' && ['hp', 'stage', 'weakness', 'resistance', 'retreatcost', 'atk', 'def'].includes(norm(parsed.label).replace(/\s+/g, ''))) continue;
    const dedupeKey = norm(parsed.label).replace(/\s+/g, '');
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    specs.push({ key: dedupeKey, label: parsed.label, icon: parsed.icon, value: parsed.value });
  }

  /* 4. Release year from joined sets when nothing better exists */
  const relDate = sets.map((s) => s?.releaseDate).find(Boolean);
  if (relDate && !seen.has('releaseyear') && !seen.has('releasedate')) {
    push('releaseYear', String(relDate).slice(0, 4));
  }

  return specs;
};

/* ────────────────────────────────────────────────────────────────
   Energy / cost token parsing
   ──────────────────────────────────────────────────────────────── */

/** franchise-aware symbol → canonical type id */
const ENERGY_MAPS = {
  pokemon: {
    g: 'grass', grass: 'grass', r: 'fire', fire: 'fire', flame: 'fire',
    w: 'water', water: 'water', l: 'lightning', lightning: 'lightning', electric: 'lightning',
    p: 'psychic', psychic: 'psychic', f: 'fighting', fighting: 'fighting',
    d: 'darkness', darkness: 'darkness', dark: 'darkness', m: 'metal', metal: 'metal', steel: 'metal',
    y: 'fairy', fairy: 'fairy', c: 'colorless', colorless: 'colorless', n: 'dragon', dragon: 'dragon'
  },
  yugioh: {
    // Yu-Gi-Oh! has no energies; keep numeric/level tokens colorless
    1: 'colorless', 2: 'colorless', 3: 'colorless', 4: 'colorless',
    5: 'colorless', 6: 'colorless', 7: 'colorless', 8: 'colorless'
  },
  mtg: {
    w: 'white', white: 'white', u: 'blue', blue: 'blue', island: 'blue',
    b: 'black', black: 'black', swamp: 'black', r: 'red', red: 'red', mountain: 'red',
    g: 'green', green: 'green', forest: 'green', c: 'colorless', 1: 'colorless', 2: 'colorless',
    3: 'colorless', 4: 'colorless', 5: 'colorless', 6: 'colorless', 7: 'colorless', t: 'tap'
  },
  onepiece: {
    // One Piece colors
    red: 'fire', green: 'grass', blue: 'water', purple: 'psychic',
    black: 'darkness', yellow: 'lightning', white: 'colorless', don: 'dragon'
  }
};

const DEFAULT_MAP = {
  ...ENERGY_MAPS.pokemon,
  fire: 'fire', water: 'water', grass: 'grass', light: 'lightning',
  lightning: 'lightning', dark: 'darkness', darkness: 'darkness',
  metal: 'metal', psychic: 'psychic', fighting: 'fighting', fairy: 'fairy',
  dragon: 'dragon', colorless: 'colorless', star: 'colorless', void: 'colorless'
};

/**
 * Expand ONE bracket symbol into one-or-more energy tokens.
 *   "P"  → 1 psychic        (single-letter code)
 *   "PP" → 2 psychic        (repeated single-letter code)
 *   "GR" → grass + fire     (mixed single-letter codes)
 *   "1"  → 1 colorless      (numeric = that many colorless)
 *   "Fire" → 1 fire         (known word)
 */
const pushSymbolTokens = (sym, map, tokens) => {
  const lower = String(sym).toLowerCase();
  if (map[lower]) {
    tokens.push({ type: map[lower], symbol: lower });
    return;
  }
  if (/^\d$/.test(lower)) {
    const n = Math.min(8, Number(lower) || 1);
    for (let i = 0; i < n; i++) tokens.push({ type: 'colorless', symbol: lower });
    return;
  }
  if (/^\d+$/.test(lower)) {
    tokens.push({ type: 'colorless', symbol: lower });
    return;
  }
  if (/^[a-z]+$/i.test(lower)) {
    const chars = lower.split('');
    if (map[chars[0]] && chars.every((ch) => ch === chars[0])) {
      // repeated code: PP, RR, CCC
      for (const ch of chars) tokens.push({ type: map[ch], symbol: chars[0] });
      return;
    }
    if (chars.every((ch) => map[ch])) {
      // mixed codes: GR, PW
      for (const ch of chars) tokens.push({ type: map[ch], symbol: ch });
      return;
    }
  }
  tokens.push({ type: 'colorless', symbol: lower });
};

/**
 * Parse a cost string into styled energy tokens.
 *   "[PP]"            → [psychic, psychic]
 *   "[1][G][R]"       → [colorless, grass, fire]
 *   "[Fire][Fire]"    → [fire, fire]
 *   "{2}{R}" (MTG)    → [colorless, colorless, fire]
 *   "Water ×2"        → [water, water]
 */
export const parseEnergyCost = (costStr, franchise = 'generic') => {
  if (costStr === null || costStr === undefined || costStr === '') return [];
  const map = ENERGY_MAPS[franchise?.id] || DEFAULT_MAP;
  const tokens = [];

  // bracket notation first: [PP], [G][R], [Fire], {2}{R}
  const bracketRe = /\[([A-Za-z0-9]+)\]|\{([A-Za-z0-9]+)\}/g;
  let m;
  let usedBrackets = false;
  while ((m = bracketRe.exec(safeStr(costStr))) !== null) {
    usedBrackets = true;
    pushSymbolTokens(m[1] || m[2], map, tokens);
  }
  if (usedBrackets) return tokens;

  // "Water ×2" / "Fire x 2" notation
  const repeatRe = /([A-Za-z]+)\s*[x×]\s*(\d+)/gi;
  let r;
  let usedRepeat = false;
  while ((r = repeatRe.exec(safeStr(costStr))) !== null) {
    usedRepeat = true;
    const mapped = map[norm(r[1])] || DEFAULT_MAP[norm(r[1])] || 'colorless';
    const count = Math.min(8, parseInt(r[2], 10) || 1);
    for (let i = 0; i < count; i++) tokens.push({ type: mapped, symbol: norm(r[1]) });
  }
  if (usedRepeat) return tokens;

  // plain words: "Fire Fire Colorless"
  for (const w of safeStr(costStr).split(/[\s,+/|]+/).filter(Boolean)) {
    const mapped = map[norm(w)] || DEFAULT_MAP[norm(w)];
    if (mapped) tokens.push({ type: mapped, symbol: norm(w) });
  }
  return tokens;
};

/* ────────────────────────────────────────────────────────────────
   Attack / effect extraction
   ──────────────────────────────────────────────────────────────── */

/**
 * Normalize one attack-ish object {name, cost, damage, text} from any
 * franchise payload shape into a canonical record.
 */
const normalizeAttackEntry = (entry, franchise) => {
  if (!entry || typeof entry !== 'object') return null;
  const name = entry.name || entry.attackName || entry.title || null;
  const cost = entry.cost ?? entry.costs ?? entry.energyCost ?? entry.convertedEnergyCost ?? null;
  const damage = entry.damage ?? entry.dmg ?? entry.power ?? entry.attack ?? null;
  const text = entry.text ?? entry.description ?? entry.effect ?? entry.rules ?? null;

  if (!name && !text && isBlank(cost) && isBlank(damage)) return null;

  const safeCost = typeof cost === 'object' ? null : cost;
  return {
    name: safeStr(name || 'Effect') || 'Effect',
    costTokens: parseEnergyCost(typeof safeCost === 'number' ? String(safeCost) : safeCost, franchise),
    costLabel: safeCost != null && safeStr(safeCost).trim() !== '' ? safeStr(safeCost) : null,
    damage: damage != null ? safeStr(damage) : null,
    text: text ? safeStr(text).trim() : null
  };
};

/** True when a text block looks like an attack header line (contains a cost bracket) */
const hasCostBracket = (s) => /\[([A-Za-z0-9]+)\]|\{([A-Za-z0-9]+)\}/.test(s);

/** Yu-Gi-Oh! stat line — "ATK/1900 DEF/2500" already handled as specs; here catch "1900/2500" headers */
const YGO_STATLINE_RE = /^(\d{3,4})\s*\/\s*(\d{3,4})$/;

/**
 * Mine attacks out of free-form description text.
 * Recognized shapes:
 *   [PP] Psychic Sphere 60 — flip a coin…
 *   [2][G] Leaf Blade 30+
 *   Fire Spin [R][R][C] 100 — discard an Energy
 *   Ability — Solar Power: Once during your turn…
 */
export const parseAttacksFromText = (text, franchise = { id: 'generic' }) => {
  if (!text || typeof text !== 'string') return [];
  const attacks = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^[-•*·]\s*/, '').trim();
    if (!line) continue;

    const bracketMatch = line.match(/^((?:\[[A-Za-z0-9]+\]|\{[A-Za-z0-9]+\})+)\s*(.*)$/);
    // Inline shape: "Flamethrower [R][C] 100" OR "Attack 1:[PP] Name"
    // (label + colon glued directly to the bracket — no space).
    const inlineMatch = !bracketMatch
      ? line.match(/^(.{2,40}?)\s*:?\s*((?:\[[A-Za-z0-9]+\]|\{[A-Za-z0-9]+\})+)\s*(.*)$/)
      : null;

    if (bracketMatch || inlineMatch) {
      const cost = (bracketMatch ? bracketMatch[1] : inlineMatch[2]);
      // "Flamethrower [R][C] 100: Discard an Energy" — inline shape keeps
      // the pre-cost words as the attack name. Generic indexed labels
      // ("Attack 1", "Attack 2") are dropped so they don't pollute names.
      const rawPrefix = inlineMatch ? inlineMatch[1].trim() : '';
      const prefix = rawPrefix.replace(/(?:^|[-–—:])\s*Attack\s*\d*\s*:?$/i, '').replace(/:$/, '').trim();
      let rest = (bracketMatch ? bracketMatch[2] : inlineMatch[3]) || '';

      // Trailing "(230)" → damage 230; "(230+)" stays with its plus.
      let parenDamage = null;
      rest = rest.replace(/\s*\((\d{1,4}\+?)\)\s*$/, (_, d) => {
        parenDamage = d;
        return ' ';
      }).trim();

      // Decompose the tail: "Name? Damage? [—/: text]?"
      let name = null;
      let damage = parenDamage;
      let text = null;
      let m2;
      if ((m2 = rest.match(/^(?:(.+?)\s+)?(\d{1,4}\+?)\s*(?:[-–—:]\s+)?(.+)?$/)) && (m2[1] || m2[3])) {
        name = m2[1] ? m2[1].trim() : null;
        damage = damage || m2[2];
        // "120: text" leaves m2[3] = "text"; "Name 120" leaves null
        text = m2[3] ? m2[3].trim() : null;
      } else if ((m2 = rest.match(/^(.+?)\s*(?:[-–—:]+)\s+(.+)$/))) {
        // "Ability — Solar Power: Once during your turn…"
        name = m2[1].trim();
        text = m2[2].trim();
      } else {
        name = rest.trim() || null;
      }
      // strip a leading separator from text like ": Discard…" edge cases
      if (text) text = text.replace(/^(?:[-–—:]\s*)+/, '').trim();
      const fullName = [prefix, name].filter(Boolean).join(' ') || 'Attack';

      const entry = normalizeAttackEntry({ name: fullName, cost, damage, text }, franchise);
      if (entry) attacks.push(entry);
      continue;
    }

    const ygo = line.match(YGO_STATLINE_RE);
    if (ygo && franchise.id === 'yugioh') {
      attacks.push(normalizeAttackEntry({ name: 'ATK / DEF', damage: `${ygo[1]} / ${ygo[2]}` }, franchise));
      continue;
    }
  }

  return attacks;
};

/**
 * Master attack parser. Structured JSON beats regex: check
 * attributes.attacks / attributes.abilities / attributes.effects first,
 * then mine the description.
 */
export const parseAttacks = (product, productType = null) => {
  if (!product || typeof product !== 'object') return [];
  const type = productType || parseProductType(product);
  if (type === 'BOX') return [];

  const franchise = detectFranchise(product);
  const found = [];
  const seenNames = new Set();

  const addAll = (list) => {
    for (const entry of safeArr(list)) {
      if (!entry) continue;
      // Entries already normalized by parseAttacksFromText keep their
      // parsed cost tokens — re-normalizing would strip the cost field.
      const normEntry = entry.costTokens
        ? entry
        : normalizeAttackEntry(typeof entry === 'object' ? entry : { text: String(entry) }, franchise);
      if (!normEntry) continue;
      const dk = norm(normEntry.name);
      if (seenNames.has(dk)) continue;
      seenNames.add(dk);
      found.push(normEntry);
    }
  };

  const attrs = safeObj(product.attributes);
  addAll(Array.isArray(attrs.attacks) ? attrs.attacks : null);
  addAll(Array.isArray(attrs.abilities) ? attrs.abilities : null);
  addAll(Array.isArray(attrs.effects) ? attrs.effects : null);
  addAll(Array.isArray(attrs.moves) ? attrs.moves : null);

  if (found.length === 0 && product.description && hasCostBracket(product.description)) {
    addAll(parseAttacksFromText(product.description, franchise));
  }

  return found;
};

/* ────────────────────────────────────────────────────────────────
   Data quality helpers
   ──────────────────────────────────────────────────────────────── */

/**
 * Strip spec/attack lines out of a description once the parser has
 * promoted them to structured UI, so the prose block never repeats
 * raw slash text that already renders as badges.
 */
export const extractProse = (description, productType = null) => {
  if (!description || typeof description !== 'string') return '';
  const keep = [];
  const type = productType;
  const hasAnyStructured = (line) => {
    try {
      return SPEC_LINE_RE.test(line) || hasCostBracket(line) || YGO_STATLINE_RE.test(safeStr(line).trim());
    } catch {
      return false;
    }
  };

  for (const raw of description.split(/\r?\n/)) {
    const line = safeStr(raw).trim();
    if (!line) continue;
    if (type !== null && hasAnyStructured(line)) continue;
    keep.push(line);
  }
  return keep.join('\n');
};

/**
 * Full one-shot parse used by ProductDetail. Memo-friendly.
 * Never throws: any malformed payload degrades to empty structures.
 */
export const parseProductData = (product) => {
  try {
    const clean = repairProductEncoding(product);
    const productType = parseProductType(clean);
    const franchise = detectFranchise(clean);
    const attacks = parseAttacks(clean, productType);
    const specs = parseSpecs(clean, productType);
    const prose = extractProse(clean?.description, productType);
    return {
      productType,
      franchise,
      attacks: safeArr(attacks),
      specs: safeArr(specs),
      prose: safeStr(prose)
    };
  } catch (err) {
    // A parser bug must never blank the page — log and degrade gracefully.
    console.error('[productDataParser] parseProductData failed, falling back to empty data:', err);
    return { productType: null, franchise: { id: 'generic', label: null }, attacks: [], specs: [], prose: '' };
  }
};

export default { parseProductData, parseProductType, parseSpecs, parseAttacks, detectFranchise };
