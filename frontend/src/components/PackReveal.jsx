import React, { useEffect, useMemo, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import TiltCard from './TiltCard';
import RarityBadge from './RarityBadge';
import { resolveRarity } from './RarityBadge';

const TIER_GLOW = {
  secret: 'from-amber-300 via-fuchsia-400 to-cyan-300',
  rainbow: 'from-rose-400 via-fuchsia-500 to-amber-300',
  hyper: 'from-amber-300 via-fuchsia-400 to-cyan-300',
  ultra: 'from-violet-500 via-fuchsia-500 to-pink-400',
  illustration: 'from-sky-400 via-indigo-500 to-fuchsia-400',
  special: 'from-cyan-400 via-sky-500 to-violet-400',
  holo: 'from-sky-400 via-blue-500 to-violet-400',
  rare: 'from-indigo-400 via-violet-500 to-fuchsia-400',
  common: 'from-slate-400 to-slate-500',
  uncommon: 'from-emerald-400 to-teal-500'
};

const PackReveal = ({ open, onClose, product }) => {
  const [phase, setPhase] = useState('pack');

  const meta = resolveRarity(product?.rarity);
  const tierKey =
    product?.rarity ? String(product.rarity).toLowerCase().replace(/\s+/g, '') : 'rare';
  const glow = TIER_GLOW[tierKey] || (meta?.foil ? 'from-violet-500 via-fuchsia-500 to-cyan-400' : 'from-indigo-400 via-violet-500 to-fuchsia-400');

  const particles = useMemo(() =>
    Array.from({ length: 28 }).map((_, i) => {
      const angle = (i / 28) * Math.PI * 2 + Math.random();
      const dist = 90 + Math.random() * 160;
      const colors = ['#22d3ee', '#d946ef', '#8b5cf6', '#e9c46a', '#ffffff'];
      return {
        id: i,
        px: `${Math.cos(angle) * dist}px`,
        py: `${Math.sin(angle) * dist}px`,
        pc: colors[i % colors.length],
        delay: `${Math.random() * 0.08}s`
      };
    }), [open]);

  useEffect(() => {
    if (!open) return;
    setPhase('pack');
    const t1 = setTimeout(() => setPhase('revealing'), 750);
    const t2 = setTimeout(() => setPhase('revealed'), 1400);
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const image = product?.images && product.images.length > 0 ? product.images[0] : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md animate-tcg-fade-in" onClick={onClose} />
      <div className={`relative w-full max-w-lg ${phase === 'revealing' ? 'pack-shake' : ''}`}>
        {/* Aura behind reveal */}
        <div className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-72 w-72 rounded-full bg-gradient-to-br ${glow} blur-3xl opacity-60 ${phase === 'revealed' ? 'animate-aura-pulse' : ''}`} />

        {/* Particle burst */}
        {phase !== 'pack' && (
          <div className="pointer-events-none absolute inset-0 z-30">
            {particles.map((p) => (
              <span
                key={p.id}
                className="pack-particle"
                style={{ '--px': p.px, '--py': p.py, '--pc': p.pc, animationDelay: p.delay }}
              />
            ))}
          </div>
        )}

        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 z-40 p-2 rounded-full glass-panel text-strong hover:scale-105 transition-transform"
        >
          <X className="h-5 w-5" />
        </button>

        {phase === 'pack' ? (
          <div className="relative h-[360px] flex items-center justify-center">
            <div className="relative w-52 h-72">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 aura-glow overflow-hidden">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="h-12 w-12 text-white/90 animate-tcg-float" />
                </div>
              </div>
              <p className="absolute bottom-3 inset-x-0 text-center text-white font-display font-bold text-sm">Booster Pack</p>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col items-center">
            {/* torn pack halves */}
            <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 w-52 h-10 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-t-2xl opacity-0" style={{ animation: 'pack-tear-top 0.55s ease-in forwards' }} />
            {/* revealed card */}
            <div className="pack-card-rise">
              <TiltCard max={20} scale={1.05} className="relative w-56 sm:w-64 rounded-3xl">
                <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-gradient-to-br from-white/80 to-primary-50/40 dark:from-white/5 dark:to-aura-violet/10 flex items-center justify-center p-3">
                  {image ? (
                    <img src={image} alt={product?.name} className="max-h-full w-auto object-contain drop-shadow-[0_20px_40px_rgba(217,70,239,0.5)]" />
                  ) : (
                    <span className="text-strong font-semibold">{product?.shortName || product?.name}</span>
                  )}
                </div>
              </TiltCard>
            </div>
            <div className="mt-5 text-center animate-tcg-reveal">
              <RarityBadge rarity={product?.rarity} size="lg" />
              <p className="mt-3 text-white font-display text-xl font-bold">Chúc mừng!</p>
              <p className="text-white/70 text-sm">{product?.shortName || product?.name}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PackReveal;
