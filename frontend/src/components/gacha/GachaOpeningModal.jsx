import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Sparkles, MousePointerClick, AlertTriangle, RefreshCw, Gem, Crown, Sparkle } from 'lucide-react';
import api from '../../services/api';
import TiltCard from '../TiltCard';
import ProductImage from '../ProductImage';
import { playTear, playReveal, playTick, vibrate } from '../../utils/sfx';

/* ── Gacha rarity treatments (backend enum: COMMON/RARE/EPIC/LEGENDARY) ── */
const GACHA_RARITY = {
  COMMON: {
    label: 'Common',
    tier: 1,
    icon: null,
    badge: 'from-slate-300 via-slate-400 to-slate-500',
    frame: 'linear-gradient(160deg, #e2e8f0, #94a3b8 45%, #cbd5e1 75%, #64748b)',
    aura: 'from-slate-300/40 to-slate-500/40',
    flash: 'rgba(226, 232, 240, 0.35)',
    headline: 'You pulled'
  },
  RARE: {
    label: 'Rare',
    tier: 2,
    icon: Sparkle,
    badge: 'from-indigo-400 via-violet-500 to-fuchsia-400',
    frame: 'linear-gradient(160deg, #818cf8, #a78bfa 45%, #e879f9 80%, #818cf8)',
    aura: 'from-indigo-500/60 via-violet-500/60 to-fuchsia-500/60',
    flash: 'rgba(167, 139, 250, 0.5)',
    headline: 'Rare pull'
  },
  EPIC: {
    label: 'Epic',
    tier: 3,
    icon: Gem,
    badge: 'from-cyan-400 via-fuchsia-500 to-violet-500',
    frame: 'linear-gradient(120deg, #22d3ee, #d946ef 35%, #8b5cf6 65%, #22d3ee)',
    aura: 'from-cyan-400/70 via-fuchsia-500/70 to-violet-500/70',
    flash: 'rgba(56, 189, 248, 0.6)',
    headline: 'Epic pull',
    flow: true
  },
  LEGENDARY: {
    label: 'Legendary',
    tier: 4,
    icon: Crown,
    badge: 'from-amber-300 via-fuchsia-400 to-cyan-300',
    frame: 'conic-gradient(from 210deg, #fff7e6, #e9c46a 18%, #d946ef 38%, #22d3ee 58%, #8b5cf6 78%, #fff7e6)',
    aura: 'from-amber-300/70 via-fuchsia-400/70 to-cyan-300/70',
    flash: 'rgba(255, 214, 130, 0.75)',
    headline: 'Legendary pull',
    spin: true
  }
};

const resolveGachaRarity = (rarity) => {
  const key = String(rarity || '').toUpperCase().trim();
  return GACHA_RARITY[key] || GACHA_RARITY.COMMON;
};

/* ── Pack geometry (true-3D box faces) ── */
const PACK_W = 168;
const PACK_H = 238;
const PACK_D = 44;
const FRAME_PAD = 3;
const MIN_SHAKE_MS = 1400;
const TEAR_MS = 680;
const DEFAULT_GRADIENT = 'from-violet-600 via-fuchsia-600 to-pink-500';

const faceBase = {
  position: 'absolute',
  borderRadius: '10px',
  overflow: 'hidden',
  backfaceVisibility: 'hidden'
};

const isCssGradient = (g) => typeof g === 'string' && /^(linear|radial|conic)-gradient/i.test(g.trim());

/* ── FX helpers ── */
const PARTICLE_COLORS = ['#22d3ee', '#d946ef', '#8b5cf6', '#e9c46a', '#ffffff'];
const EMBER_COLORS = ['#e9c46a', '#d946ef', '#22d3ee', '#ffffff'];
const ORBIT_COLORS = ['#22d3ee', '#d946ef', '#e9c46a', '#a78bfa', '#ffffff', '#f0abfc'];

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

const makeOrbits = (count = 8) =>
  Array.from({ length: count }).map((_, i) => ({
    id: i,
    angle: `${Math.round((i / count) * 360)}deg`,
    dist: `${96 + (i % 3) * 24}px`,
    dur: `${(1.3 + (i % 4) * 0.25).toFixed(2)}s`,
    color: ORBIT_COLORS[i % ORBIT_COLORS.length],
    size: 4 + (i % 3) * 2
  }));

const GachaRarityBadge = ({ rarity, size = 'lg' }) => {
  const meta = resolveGachaRarity(rarity);
  const Icon = meta.icon;
  const sizing = size === 'lg' ? 'text-[12px] px-3.5 py-1.5' : 'text-[10px] px-2.5 py-1';
  return (
    <span
      className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-full font-bold uppercase tracking-[0.16em] text-white shadow-lg ${sizing}`}
    >
      <span className={`absolute inset-0 bg-gradient-to-r ${meta.badge} ${meta.tier >= 3 ? 'animate-tcg-gradient-x' : ''}`} />
      {meta.tier >= 3 && <span aria-hidden="true" className="foil-sheen absolute inset-0" />}
      <span className="relative z-10 inline-flex items-center gap-1.5">
        {Icon && <Icon className={size === 'lg' ? 'h-3.5 w-3.5' : 'h-3 w-3'} />}
        {meta.label}
      </span>
    </span>
  );
};

/**
 * GachaOpeningModal — unboxing FX for POST /api/v1/virtual-boxes/:id/open.
 *
 * Visual state flow:
 *   ready   → floating 3D pack, click to tear
 *   shaking → 3D pack shake + particle glow + haptics while the roll resolves
 *   tearing → jagged halves fly apart, depth-of-field rack focus
 *   revealed→ pulled card with 3D tilt physics, holo sheen and a foil frame
 *             scaled by rarity (Common / Rare / Epic / Legendary)
 *   error   → friendly failure panel with retry
 */
const GachaOpeningModal = ({
  open,
  boxId,
  boxName = 'Mystery Box',
  boxGradient,
  boxImageUrl,
  autoOpen = false,
  onClose,
  onResult
}) => {
  const [phase, setPhase] = useState('ready');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [shakeHard, setShakeHard] = useState(false);
  const [bursts, setBursts] = useState([]);
  const [embers, setEmbers] = useState([]);

  const phaseRef = useRef('ready');
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef([]);
  const onCloseRef = useRef(onClose);
  const onResultRef = useRef(onResult);
  const orbits = useMemo(() => makeOrbits(8), []);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  const product = result?.card?.product || null;
  const rarity = resolveGachaRarity(result?.card?.rarity);
  const tier = rarity.tier;
  const cardName = product?.name || product?.shortName || 'Mystery Card';
  const cardImage = Array.isArray(product?.images) && product.images.length > 0 ? product.images[0] : null;

  const isCssPack = isCssGradient(boxGradient);
  const packStops = !isCssPack && typeof boxGradient === 'string' && boxGradient.trim() ? boxGradient.trim() : DEFAULT_GRADIENT;
  const packFace = (extraStyle = {}, extraClass = '') =>
    isCssPack
      ? { style: { ...extraStyle, backgroundImage: boxGradient }, className: extraClass }
      : { style: extraStyle, className: `${extraClass} bg-gradient-to-br ${packStops}` };

  const goto = useCallback((next) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const addTimer = useCallback((fn, ms) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  const sleep = useCallback((ms) => new Promise((resolve) => addTimer(resolve, ms)), [addTimer]);

  const openBox = useCallback(async () => {
    if (busyRef.current || !boxId) return;
    busyRef.current = true;
    setError('');
    setResult(null);
    setBursts([]);
    setEmbers([]);
    setShakeHard(false);
    goto('shaking');
    vibrate([8, 30, 8]);
    if (!reducedMotion) addTimer(() => { if (mountedRef.current) setShakeHard(true); }, 750);

    const startedAt = Date.now();
    try {
      const res = await api.post(`/virtual-boxes/${boxId}/open`);
      const data = res.data?.data;
      const wait = Math.max(0, MIN_SHAKE_MS - (Date.now() - startedAt));
      if (wait > 0) await sleep(wait);
      if (!mountedRef.current) return;

      const pullTier = resolveGachaRarity(data?.card?.rarity).tier;
      playTear();
      vibrate(pullTier >= 3 ? [20, 30, 40] : [15]);
      if (!reducedMotion) setBursts(makeParticles(10 + pullTier * 6, 150));
      goto('tearing');

      await sleep(reducedMotion ? 180 : TEAR_MS);
      if (!mountedRef.current) return;

      playReveal(pullTier);
      vibrate(pullTier >= 4 ? [30, 40, 60, 40, 90] : pullTier === 3 ? [25, 35, 50] : [20, 30, 30]);
      if (!reducedMotion) {
        setBursts((prev) => [
          ...prev,
          ...makeParticles(8 + pullTier * 10, 190 + pullTier * 30).map((p) => ({ ...p, id: `b-${p.id}` }))
        ]);
        if (pullTier >= 3) setEmbers(makeEmbers(8 + pullTier * 4));
      }
      setResult(data);
      goto('revealed');
      if (onResultRef.current) onResultRef.current(data);
    } catch (err) {
      console.error('Gacha open failed:', err.response?.status, err.response?.data?.error?.message || err.message);
      if (!mountedRef.current) return;
      setError(err.response?.data?.error?.message || 'Failed to open the box. Please try again.');
      goto('error');
    } finally {
      busyRef.current = false;
    }
  }, [boxId, goto, addTimer, sleep, reducedMotion]);

  const handleEscape = useCallback((e) => {
    if (e.key !== 'Escape') return;
    const p = phaseRef.current;
    if (p !== 'shaking' && p !== 'tearing') onCloseRef.current();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!open || !boxId) return undefined;
    busyRef.current = false;
    goto('ready');
    setResult(null);
    setError('');
    setBursts([]);
    setEmbers([]);
    setShakeHard(false);

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    let auto = null;
    if (autoOpen) auto = setTimeout(() => openBox(), 650);

    return () => {
      if (auto) clearTimeout(auto);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      busyRef.current = false;
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, boxId, autoOpen, goto, handleEscape, openBox]);

  if (!open || !boxId) return null;

  const animating = phase === 'shaking' || phase === 'tearing';
  const backdropBlur = phase === 'tearing' ? 18 : phase === 'revealed' ? 14 : 10;
  const shakeCls = phase === 'shaking' && !reducedMotion ? (shakeHard ? 'gacha-shake-hard' : 'gacha-shake') : '';
  const frontFace = packFace({ ...faceBase, inset: 0, transform: `translateZ(${PACK_D / 2}px)`, boxShadow: '0 28px 56px -16px rgba(0,0,0,0.55)' }, 'sheen-sweep');
  const sideFace = packFace({ ...faceBase, top: 0, right: 0, width: PACK_D, height: PACK_H, transform: `rotateY(90deg) translateZ(${PACK_W - PACK_D / 2}px)` });
  const topFace = packFace({ ...faceBase, top: 0, left: 0, width: PACK_W, height: PACK_D, transform: `rotateX(90deg) translateZ(${PACK_D / 2}px)`, border: '1px solid rgba(255,255,255,0.25)' });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Opening ${boxName}`}>
      {/* Depth-of-field backdrop — blur deepens as the pack tears */}
      <div
        className="absolute inset-0 animate-tcg-fade-in"
        style={{
          background: 'rgba(4, 4, 10, 0.8)',
          backdropFilter: `blur(${backdropBlur}px) saturate(120%)`,
          WebkitBackdropFilter: `blur(${backdropBlur}px) saturate(120%)`,
          transition: 'backdrop-filter 0.6s ease, -webkit-backdrop-filter 0.6s ease'
        }}
        onClick={() => { if (!animating) onClose(); }}
      />

      {/* Ambient tier aura */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-1/2 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br ${rarity.aura} blur-[90px] transition-opacity duration-700 ${
          phase === 'revealed' ? 'animate-aura-pulse opacity-80' : 'opacity-30'
        }`}
      />

      {/* God rays + flash + shockwave on high-tier reveals */}
      {phase === 'revealed' && tier >= 3 && !reducedMotion && <div className="pack-god-rays" />}
      {phase === 'revealed' && !reducedMotion && tier >= 2 && (
        <div className="pack-flash" style={{ '--flash-c': rarity.flash }} />
      )}
      {phase === 'revealed' && tier === 4 && !reducedMotion && <div className="pack-shockwave" />}

      {/* Particle bursts + embers */}
      {!reducedMotion && (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {bursts.map((p) => (
            <span
              key={p.id}
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

      <div className="relative w-full max-w-lg">
        {/* Header: box name + close (hidden mid-animation so a pull is never lost) */}
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="font-display text-sm font-bold uppercase tracking-[0.18em] text-white/70">{boxName}</p>
          {!animating && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full glass-panel p-2 text-white/90 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {phase === 'error' ? (
          <div className="glass-panel mx-auto max-w-sm rounded-2xl p-7 text-center animate-tcg-scale-in">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/15 ring-1 ring-amber-300/30">
              <AlertTriangle className="h-7 w-7 text-amber-300" />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold text-white">Opening failed</h3>
            <p className="mt-1.5 text-sm text-white/70">{error}</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button onClick={() => openBox()} className="btn-primary !px-6 !py-2.5 text-sm">
                <RefreshCw className="mr-2 h-4 w-4" /> Try Again
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70"
              >
                Close
              </button>
            </div>
          </div>
        ) : phase === 'ready' || phase === 'shaking' ? (
          <div className="relative flex flex-col items-center">
            {/* Charge aura behind the pack */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute left-1/2 top-[44%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-violet-500/70 via-fuchsia-500/60 to-cyan-400/60 blur-[70px] ${
                phase === 'shaking' && !reducedMotion ? 'gacha-glow-pulse' : 'opacity-40'
              }`}
            />

            {/* Orbiting glow motes while the roll resolves */}
            {phase === 'shaking' && !reducedMotion && (
              <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[44%] z-20 h-0 w-0">
                {orbits.map((o) => (
                  <span
                    key={o.id}
                    className="gacha-orbit"
                    style={{
                      '--oa': o.angle, '--od': o.dist, '--ot': o.dur,
                      width: o.size, height: o.size,
                      background: `radial-gradient(circle, ${o.color}, transparent 75%)`,
                      boxShadow: `0 0 10px ${o.color}`
                    }}
                  />
                ))}
              </div>
            )}

            {/* Contact shadow */}
            <div aria-hidden="true" className="absolute left-1/2 top-[86%] h-6 w-40 -translate-x-1/2 rounded-[100%] bg-black/40 blur-md" />

            <button
              onClick={phase === 'ready' ? () => openBox() : undefined}
              disabled={phase !== 'ready'}
              aria-label={`Tear open ${boxName}`}
              className={`relative z-10 block cursor-pointer rounded-3xl pb-6 pt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70 ${
                phase === 'ready' ? '' : 'cursor-wait'
              }`}
            >
              <div className="box3d-stage">
                <div className={phase === 'ready' ? 'animate-tcg-float' : ''} style={{ animationDuration: '4.5s' }}>
                  <div className={`will-change-transform ${shakeCls}`}>
                    <div
                      className="box3d"
                      style={{ width: PACK_W, height: PACK_H, transform: 'rotateX(-9deg) rotateY(26deg)' }}
                    >
                      {/* front */}
                      <div {...frontFace}>
                        <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
                        <div className="absolute inset-x-0 top-2.5 h-1.5 rounded-full bg-white/25 mx-2.5" />
                        <div className="absolute inset-x-0 bottom-2.5 h-1.5 rounded-full bg-black/20 mx-2.5" />
                        {boxImageUrl && (
                          <img
                            src={boxImageUrl}
                            alt=""
                            aria-hidden="true"
                            className="absolute inset-0 h-full w-full object-cover opacity-90"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        )}
                        <div className="absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b from-white/35 to-transparent" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
                          <Sparkles className="h-10 w-10 text-white/90 drop-shadow" />
                          <p className="font-display text-sm font-bold leading-tight text-white drop-shadow">{boxName}</p>
                          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">Virtual Pack · 1 Card</p>
                        </div>
                        <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-700 shadow ring-1 ring-violet-200">
                          Sealed
                        </span>
                      </div>
                      {/* right side */}
                      <div {...sideFace}>
                        <div aria-hidden="true" className="absolute inset-0 bg-black/35" />
                      </div>
                      {/* top lid */}
                      <div {...topFace}>
                        <div aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(120deg, rgba(255,255,255,0.34), rgba(255,255,255,0.06) 55%)' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </button>

            {phase === 'ready' ? (
              <span className="relative z-10 mt-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/25 backdrop-blur animate-tcg-pulse-ring">
                <MousePointerClick className="h-4 w-4 text-aura-gold" />
                Click to tear open
              </span>
            ) : (
              <span className="relative z-10 mt-2 inline-flex items-center gap-2 text-sm font-semibold text-white/80" aria-live="polite">
                <RefreshCw className="h-4 w-4 animate-spin text-aura-gold" />
                Rolling the cards…
              </span>
            )}
          </div>
        ) : (
          <div className="relative flex flex-col items-center">
            {/* Torn pack halves — jagged foil edges flying apart, defocusing */}
            {phase === 'tearing' && !reducedMotion && (
              <div className="pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center">
                <div
                  className={`pack-tear-jagged absolute h-24 w-56 opacity-95 ${isCssPack ? '' : `bg-gradient-to-br ${packStops}`}`}
                  style={{ ...(isCssPack ? { backgroundImage: boxGradient } : {}), animation: `gacha-tear-top ${TEAR_MS}ms cubic-bezier(0.5, 0, 0.75, 0.4) forwards`, top: 0 }}
                />
                <div
                  className={`pack-tear-jagged-bottom absolute h-24 w-56 opacity-95 ${isCssPack ? '' : `bg-gradient-to-br ${packStops}`}`}
                  style={{ ...(isCssPack ? { backgroundImage: boxGradient } : {}), animation: `gacha-tear-bottom ${TEAR_MS}ms cubic-bezier(0.5, 0, 0.75, 0.4) forwards`, top: 44 }}
                />
              </div>
            )}

            {/* Revealed card — 3D tilt physics + holo sheen + rarity foil frame */}
            <div className={`relative z-10 ${phase === 'revealed' ? 'pack-card-rise' : 'opacity-0'}`}>
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br ${rarity.aura} blur-3xl ${
                  phase === 'revealed' ? 'animate-aura-pulse opacity-80' : 'opacity-0'
                }`}
              />
              <TiltCard max={18} scale={1.06} foil spotlight stiffness={180} damping={20} className="relative w-60 rounded-[1.4rem] shadow-[0_36px_80px_-20px_rgba(124,58,237,0.55)] sm:w-64">
                <div className="relative overflow-hidden rounded-[inherit]" style={{ padding: FRAME_PAD }}>
                  {/* Rarity foil frame: static (Common/Rare), flowing (Epic), rotating metallic (Legendary) */}
                  {rarity.spin && !reducedMotion ? (
                    <div aria-hidden="true" className="gacha-frame-spin absolute left-1/2 top-1/2 aspect-square w-[240%]" style={{ background: rarity.frame }} />
                  ) : (
                    <div
                      aria-hidden="true"
                      className={`absolute inset-0 ${rarity.flow && !reducedMotion ? 'gacha-frame-flow' : ''}`}
                      style={{ background: rarity.frame }}
                    />
                  )}
                  {tier >= 3 && <span aria-hidden="true" className="foil-sheen pointer-events-none absolute inset-0" />}

                  <div className="relative overflow-hidden bg-gradient-to-b from-[#17131f] to-[#0b0a12]" style={{ borderRadius: `calc(1.4rem - ${FRAME_PAD}px)` }}>
                    <div className="relative aspect-[3/4] w-full p-3">
                      <div className="absolute left-5 top-5 z-20" style={{ transform: 'translateZ(28px)' }}>
                        <GachaRarityBadge rarity={result?.card?.rarity} size="sm" />
                      </div>
                      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl" style={{ transform: 'translateZ(18px)' }}>
                        <ProductImage
                          src={cardImage}
                          alt={cardName}
                          className="max-h-full w-auto object-contain drop-shadow-[0_16px_30px_rgba(0,0,0,0.45)]"
                          fallbackClassName="h-full w-full rounded-xl"
                          iconClassName="h-9 w-9 text-white/90"
                          label={cardName}
                        />
                      </div>
                    </div>
                    <div className="border-t border-white/10 bg-white/[0.05] px-4 py-3">
                      <p className="truncate text-sm font-bold text-white">{cardName}</p>
                      <p className="mt-0.5 truncate text-[11px] text-white/55">
                        {product?.cardNumber ? `${product.cardNumber} · ` : ''}from {boxName}
                      </p>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </div>

            {/* Pull summary + actions */}
            <div className={`mt-6 text-center ${phase === 'revealed' ? 'animate-tcg-reveal' : 'opacity-0'}`}>
              <GachaRarityBadge rarity={result?.card?.rarity} />
              <p className={`mt-3 font-display text-2xl font-bold drop-shadow ${tier === 4 ? 'text-gradient-sweep' : 'text-white'}`}>
                {tier >= 3 ? rarity.headline : 'Congrats!'}
              </p>
              <p className="mt-0.5 text-sm text-white/75">{cardName}</p>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button onClick={() => { playTick(); openBox(); }} className="btn-primary !px-6 !py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Open Again
                </button>
                <button
                  onClick={() => { playTick(); onClose(); }}
                  className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70"
                >
                  Keep &amp; Close
                </button>
              </div>
              <p className="mt-3 text-[11px] text-white/45">Card saved to your collection</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GachaOpeningModal;
