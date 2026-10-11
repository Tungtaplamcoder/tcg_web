import React from 'react';
import {
  Leaf, Flame, Droplet, Zap, Eye, Swords, Moon, Cog, Sparkles,
  Star, Sun, Skull, RotateCw
} from 'lucide-react';

/**
 * ENERGY_TOKENS — canonical type id → gradient + vector glyph for the
 * cost badges. Franchise-agnostic: every parser-mapped type has a
 * visual identity, unknown types fall back to the iridescent star.
 * Glyphs are lucide-react vector icons (never raw text/character emojis).
 */
const ENERGY_TOKENS = {
  grass: { cls: 'from-lime-400 to-emerald-600', Icon: Leaf },
  fire: { cls: 'from-orange-400 to-red-600', Icon: Flame },
  water: { cls: 'from-sky-400 to-blue-600', Icon: Droplet },
  lightning: { cls: 'from-yellow-300 to-amber-500', Icon: Zap },
  psychic: { cls: 'from-fuchsia-400 to-purple-700', Icon: Eye },
  fighting: { cls: 'from-stone-400 to-red-800', Icon: Swords },
  darkness: { cls: 'from-slate-500 to-slate-800', Icon: Moon },
  metal: { cls: 'from-zinc-300 to-slate-500', Icon: Cog },
  fairy: { cls: 'from-pink-300 to-rose-500', Icon: Sparkles },
  dragon: { cls: 'from-cyan-300 to-fuchsia-500', Icon: Flame },
  colorless: { cls: 'from-slate-100 to-slate-400', Icon: Star, light: true },
  white: { cls: 'from-zinc-100 to-zinc-300', Icon: Sun, light: true },
  blue: { cls: 'from-sky-400 to-indigo-600', Icon: Droplet },
  black: { cls: 'from-slate-600 to-slate-900', Icon: Skull },
  red: { cls: 'from-rose-400 to-red-600', Icon: Flame },
  green: { cls: 'from-emerald-400 to-green-700', Icon: Leaf },
  tap: { cls: 'from-neutral-400 to-neutral-700', Icon: RotateCw }
};

const EnergyBadge = ({ token, size = 'md' }) => {
  const meta = ENERGY_TOKENS[token?.type] || { cls: 'from-violet-400 to-fuchsia-600', Icon: Star };
  const dim = size === 'lg' ? 'h-8 w-8' : size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  const iconDim = size === 'lg' ? 'h-4 w-4' : size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const Glyph = meta.Icon;
  return (
    <span
      title={token?.symbol || token?.type}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${meta.cls} ${dim}
        shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_6px_-1px_rgba(0,0,0,0.4)]
        ${meta.light ? 'text-slate-700' : 'text-white'} ring-1 ring-black/10`}
    >
      <Glyph className={iconDim} aria-hidden="true" />
    </span>
  );
};

/** Row of energy cost tokens with a soft count summary */
export const EnergyCostRow = ({ tokens = [], size = 'md' }) => {
  if (!tokens || tokens.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {tokens.map((t, i) => (
        <EnergyBadge key={`${t.type}-${t.symbol}-${i}`} token={t} size={size} />
      ))}
    </span>
  );
};

export default EnergyBadge;
