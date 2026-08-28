import React from 'react';
import { Sparkle, Gem, Crown } from 'lucide-react';

/**
 * Maps a rarity label to an iridescent foil treatment + icon.
 * Falls back gracefully for unknown rarities.
 */
const RARITY_TIERS = {
  'secret rare': { label: 'Secret Rare', cls: 'from-fuchsia-500 via-violet-500 to-cyan-400', icon: Crown, foil: true },
  'rainbow rare': { label: 'Rainbow Rare', cls: 'from-rose-400 via-fuchsia-500 to-amber-300', icon: Gem, foil: true },
  'illustration rare': { label: 'Illustration Rare', cls: 'from-sky-400 via-indigo-500 to-fuchsia-400', icon: Sparkle, foil: true },
  'hyper rare': { label: 'Hyper Rare', cls: 'from-amber-300 via-fuchsia-400 to-cyan-300', icon: Crown, foil: true },
  'ultra rare': { label: 'Ultra Rare', cls: 'from-violet-500 via-fuchsia-500 to-pink-400', icon: Gem, foil: true },
  'special rare': { label: 'Special Rare', cls: 'from-cyan-400 via-sky-500 to-violet-400', icon: Gem, foil: true },
  'holo rare': { label: 'Holo Rare', cls: 'from-sky-400 via-blue-500 to-violet-400', icon: Sparkle, foil: true },
  'rare': { label: 'Rare', cls: 'from-indigo-400 via-violet-500 to-fuchsia-400', icon: Sparkle, foil: false },
  'common': { label: 'Common', cls: 'from-slate-400 to-slate-500', icon: null, foil: false },
  'uncommon': { label: 'Uncommon', cls: 'from-emerald-400 to-teal-500', icon: null, foil: false }
};

export const resolveRarity = (rarity) => {
  if (!rarity) return null;
  const key = String(rarity).toLowerCase().trim();
  return RARITY_TIERS[key] || { label: rarity, cls: 'from-primary-500 to-fuchsia-500', icon: Sparkle, foil: false };
};

const RarityBadge = ({ rarity, size = 'sm', className = '' }) => {
  const meta = resolveRarity(rarity);
  if (!meta) return null;
  const Icon = meta.icon;
  const sizing = size === 'lg' ? 'text-[12px] px-3 py-1.5' : 'text-[10px] px-2.5 py-1';
  return (
    <span
      className={`relative inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-[0.14em] text-white shadow-lg overflow-hidden ${sizing} ${className}`}
    >
      <span className={`absolute inset-0 bg-gradient-to-r ${meta.cls}`} />
      {meta.foil && <span className="foil-sheen absolute inset-0" />}
      <span className="relative z-10 inline-flex items-center gap-1">
        {Icon && <Icon className={size === 'lg' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />}
        {meta.label}
      </span>
    </span>
  );
};

export default RarityBadge;
