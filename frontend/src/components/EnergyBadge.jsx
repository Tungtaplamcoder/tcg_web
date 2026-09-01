import React from 'react';

/**
 * ENERGY_TOKENS — canonical type id → gradient + glyph for the
 * cost badges. Franchise-agnostic: every parser-mapped type has a
 * visual identity, unknown types fall back to the iridescent star.
 */
const ENERGY_TOKENS = {
  grass: { cls: 'from-lime-400 to-emerald-600', glyph: '🍃' },
  fire: { cls: 'from-orange-400 to-red-600', glyph: '🔥' },
  water: { cls: 'from-sky-400 to-blue-600', glyph: '💧' },
  lightning: { cls: 'from-yellow-300 to-amber-500', glyph: '⚡' },
  psychic: { cls: 'from-fuchsia-400 to-purple-700', glyph: '👁' },
  fighting: { cls: 'from-stone-400 to-red-800', glyph: '✊' },
  darkness: { cls: 'from-slate-500 to-slate-800', glyph: '🌙' },
  metal: { cls: 'from-zinc-300 to-slate-500', glyph: '⚙' },
  fairy: { cls: 'from-pink-300 to-rose-500', glyph: '✨' },
  dragon: { cls: 'from-cyan-300 to-fuchsia-500', glyph: '🐲' },
  colorless: { cls: 'from-slate-100 to-slate-400', glyph: '★', light: true },
  white: { cls: 'from-zinc-100 to-zinc-300', glyph: '☀', light: true },
  blue: { cls: 'from-sky-400 to-indigo-600', glyph: '💧' },
  black: { cls: 'from-slate-600 to-slate-900', glyph: '☠' },
  red: { cls: 'from-rose-400 to-red-600', glyph: '🔥' },
  green: { cls: 'from-emerald-400 to-green-700', glyph: '🍃' },
  tap: { cls: 'from-neutral-400 to-neutral-700', glyph: '↻' }
};

const EnergyBadge = ({ token, size = 'md' }) => {
  const meta = ENERGY_TOKENS[token?.type] || { cls: 'from-violet-400 to-fuchsia-600', glyph: '★' };
  const dim = size === 'lg' ? 'h-8 w-8 text-[15px]' : size === 'sm' ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[11px]';
  return (
    <span
      title={token?.symbol || token?.type}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${meta.cls} ${dim} font-bold
        shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_6px_-1px_rgba(0,0,0,0.4)]
        ${meta.light ? 'text-slate-700' : 'text-white'} ring-1 ring-black/10`}
    >
      {meta.glyph}
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
