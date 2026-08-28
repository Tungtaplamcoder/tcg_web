import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Sparkles, MousePointerClick } from 'lucide-react';
import TiltCard from './TiltCard';
import RarityBadge, { resolveRarity } from './RarityBadge';
import { playTear, playReveal, vibrate } from '../utils/sfx';

/* Tier ladder: 1 common → 4 chase. Drives particles, shake, rays, sfx, haptics */
const TIER_BY_RARITY = {
  common: 1, uncommon: 1,
  rare: 2, 'holo rare': 2,
  'ultra rare': 3, 'illustration rare': 3, 'special rare': 3,
  'secret rare': 4, 'rainbow rare': 4, 'hyper rare': 4
};

const TIER_GLOW = {
  1: 'from-slate-400/60 to-slate-500/60',
  2: 'from-indigo-400/70 via-violet-500/70 to-fuchsia-400/70',
  3: 'from-sky-400/80 via-fuchsia-500/80 to-violet-500/80',
  4: 'from-amber-300/90 via-fuchsia-400/90 to-cyan-300/90'
};

const PARTICLE_COLORS = ['#22d3ee', '#d946ef', '#8b5cf6', '#e9c46a', '#ffffff'];

const TIER_FLASH = {
  2: 'rgba(167, 139, 250, 0.5)',
  3: 'rgba(56, 189, 248, 0.6)',
  4: 'rgba(255, 214, 130, 0.75)'
};

const EMBER_COLORS = ['#e9c46a', '#d946ef', '#22d3ee', '#ffffff'];

const makeParticles = (count, spread = 160) =>
  Array.from({ length: count }).map((_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 70 + Math.random() * spread;
    return {
      id: i,
      px: `${Math.cos(angle) * dist}px`,
      py: `${Math.sin(angle) * dist}px`,
      pc: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      size: 5 + Math.random() * 6,
      delay: `${Math.random() * 0.12}s`
    };
  });

const makeEmbers = (count) =>
  Array.from({ length: count }).map((_, i) => ({
    id: i,
    ex: `${((Math.random() - 0.5) * 170).toFixed(0)}px`,
    ey: `${-(90 + Math.random() * 170).toFixed(0)}px`,
    size: 3 + Math.random() * 5,
    color: EMBER_COLORS[i % EMBER_COLORS.length],
    dur: `${(1.8 + Math.random() * 1.4).toFixed(2)}s`,
    delay: `${(Math.random() * 0.5).toFixed(2)}s`
  }));

const PackReveal = ({ open, onClose, product }) => {
  const [phase, setPhase] = useState('pack');
  const timersRef = useRef([]);
  const [burst1, setBurst1] = useState([]);
  const [burst2, setBurst2] = useState([]);
  const [embers, setEmbers] = useState([]);

  const meta = resolveRarity(product?.rarity);
  const rarityKey = product?.rarity ? String(product.rarity).toLowerCase().trim() : 'rare';
  const tier = TIER_BY_RARITY[rarityKey] || (meta?.foil ? 3 : 2);
  const glow = TIER_GLOW[tier];
  const isChase = tier >= 3;

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const addTimer = (fn, ms) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
  };

  /* Kick off the tear sequence (auto or on click) */
  const startTear = () => {
    setPhase((p) => {
      if (p !== 'pack') return p;
      if (!reducedMotion) {
        playTear();
        vibrate(tier >= 3 ? [20, 30, 40] : [15]);
        setBurst1(makeParticles(10 + tier * 6, 140));
      }
      addTimer(() => {
        if (!reducedMotion) {
          playReveal(tier);
          vibrate(isChase ? [30, 40, 60, 40, 90] : [20, 30, 30]);
          setBurst2(makeParticles(8 + tier * 10, 200 + tier * 30));
          if (tier >= 3) setEmbers(makeEmbers(10 + tier * 4));
        }
        setPhase('revealed');
      }, reducedMotion ? 200 : 620);
      return 'tearing';
    });
  };

  useEffect(() => {
    if (!open) return;
    setPhase('pack');
    setBurst1([]);
    setBurst2([]);
    setEmbers([]);
    timersRef.current = [];
    // Auto-open after a beat so the flow feels alive without a click
    const auto = setTimeout(() => startTear(), 1100);
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(auto);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const image = product?.images && product.images.length > 0 ? product.images[0] : null;
  const shaking = phase !== 'pack' && !reducedMotion && (tier >= 2 ? 'pack-shake' : '') + (tier >= 4 && phase !== 'revealed' ? ' pack-shake-hard' : '');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Pack opening">
      {/* Depth-of-field backdrop */}
      <div className="pack-backdrop animate-tcg-fade-in" onClick={onClose} />

      {/* Ambient tier aura */}
      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[22rem] w-[22rem] rounded-full bg-gradient-to-br ${glow} blur-[90px] transition-opacity duration-700 ${
          phase === 'revealed' ? 'opacity-70 animate-aura-pulse' : 'opacity-30'
        }`}
      />

      {/* God rays for chase pulls */}
      {phase === 'revealed' && isChase && !reducedMotion && <div className="pack-god-rays" />}

      {/* Rarity flash — tier-colored burst of light at the reveal moment */}
      {phase === 'revealed' && !reducedMotion && tier >= 2 && (
        <div className="pack-flash" style={{ '--flash-c': TIER_FLASH[tier] }} />
      )}

      {/* Shockwave ring for chase pulls */}
      {phase === 'revealed' && isChase && !reducedMotion && <div className="pack-shockwave" />}

      {/* Particle bursts */}
      {!reducedMotion && (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {burst1.map((p) => (
            <span
              key={`a-${p.id}`}
              className="pack-particle"
              style={{ '--px': p.px, '--py': p.py, '--pc': p.pc, width: p.size, height: p.size, animationDelay: p.delay }}
            />
          ))}
          {burst2.map((p) => (
            <span
              key={`b-${p.id}`}
              className="pack-particle"
              style={{ '--px': p.px, '--py': p.py, '--pc': p.pc, width: p.size, height: p.size, animationDelay: p.delay }}
            />
          ))}
          {embers.map((p) => (
            <span
              key={`e-${p.id}`}
              className="pack-ember"
              style={{
                '--ex': p.ex, '--ey': p.ey, '--ed': p.dur,
                width: p.size, height: p.size,
                background: `radial-gradient(circle, ${p.color}, transparent 75%)`,
                boxShadow: `0 0 8px ${p.color}`,
                animationDelay: p.delay
              }}
            />
          ))}
        </div>
      )}

      <div className={`relative w-full max-w-lg ${shaking}`}>
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 z-40 p-2 rounded-full glass-panel text-strong hover:scale-105 transition-transform"
        >
          <X className="h-5 w-5" />
        </button>

        {phase === 'pack' ? (
          <button
            onClick={startTear}
            className="relative mx-auto block h-[380px] w-full max-w-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70 rounded-3xl"
            aria-label="Tear open the booster pack"
          >
            <div className="relative h-full flex flex-col items-center justify-center gap-5">
              <div className="box3d-stage">
                <div className="animate-tcg-float" style={{ animationDuration: '4.5s' }}>
                  <TiltCard max={22} scale={1.08} className="relative w-52 h-72 rounded-2xl">
                    {/* Pack body */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 aura-glow overflow-hidden shadow-[0_30px_60px_-15px_rgba(217,70,239,0.55)]">
                      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                      {/* crimp seams */}
                      <div className="absolute inset-x-0 top-2.5 h-1.5 rounded-full bg-white/25" />
                      <div className="absolute inset-x-0 bottom-2.5 h-1.5 rounded-full bg-black/20" />
                      <div className="absolute inset-x-0 top-1/3 h-px bg-white/40" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="h-12 w-12 text-white/90 animate-tcg-float" style={{ animationDuration: '3s' }} />
                      </div>
                      {/* top sheen */}
                      <div className="absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b from-white/35 to-transparent" />
                    </div>
                    <p className="absolute bottom-3 inset-x-0 text-center text-white font-display font-bold text-sm drop-shadow">
                      Booster Pack
                    </p>
                  </TiltCard>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/25 backdrop-blur px-4 py-2 text-sm font-semibold text-white/90 animate-tcg-pulse-ring">
                <MousePointerClick className="h-4 w-4 text-aura-gold" />
                Nhấn để mở pack
              </span>
            </div>
          </button>
        ) : (
          <div className="relative flex flex-col items-center">
            {/* Torn pack halves — jagged foil edges flying apart */}
            {phase === 'tearing' && (
              <div className="pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center">
                <div
                  className="pack-tear-jagged absolute w-56 h-24 bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-400 opacity-95"
                  style={{ animation: 'pack-tear-top 0.62s cubic-bezier(0.5, 0, 0.75, 0.4) forwards', top: 0 }}
                />
                <div
                  className="pack-tear-jagged-bottom absolute w-56 h-24 bg-gradient-to-tr from-violet-600 via-fuchsia-600 to-pink-500 opacity-95"
                  style={{ animation: 'pack-tear-bottom 0.62s cubic-bezier(0.5, 0, 0.75, 0.4) forwards', top: 40 }}
                />
              </div>
            )}

            {/* Revealed card */}
            <div className={`relative z-10 ${phase === 'revealed' ? 'pack-card-rise' : 'opacity-0'}`}>
              <div className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-gradient-to-br ${glow} blur-3xl opacity-70`} />
              <TiltCard max={20} scale={1.06} foil spotlight className="relative w-56 sm:w-64 rounded-3xl">
                <div className="relative aspect-[3/4] rounded-3xl overflow-hidden bg-gradient-to-br from-white/85 to-primary-50/50 dark:from-white/5 dark:to-aura-violet/10 ring-1 ring-white/40 dark:ring-white/10 flex items-center justify-center p-3 backdrop-blur-sm">
                  {image ? (
                    <img
                      src={image}
                      alt={product?.name}
                      className="max-h-full w-auto object-contain drop-shadow-[0_20px_40px_rgba(217,70,239,0.5)]"
                    />
                  ) : (
                    <span className="text-strong font-semibold text-center px-2">{product?.shortName || product?.name || 'Chưa có ảnh'}</span>
                  )}
                </div>
              </TiltCard>
            </div>

            <div className={`mt-6 text-center ${phase === 'revealed' ? 'animate-tcg-reveal' : 'opacity-0'}`}>
              <RarityBadge rarity={product?.rarity} size="lg" />
              <p className="mt-3 text-white font-display text-2xl font-bold drop-shadow">
                {isChase ? 'CHÚC MỪNG! PULL HIẾM!' : 'Chúc mừng!'}
              </p>
              <p className="text-white/75 text-sm mt-0.5">{product?.shortName || product?.name}</p>
              <button onClick={onClose} className="btn-secondary mt-5 !py-2.5 !px-6 text-sm !text-white !border-white/25 !bg-white/10">
                Đóng
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PackReveal;
