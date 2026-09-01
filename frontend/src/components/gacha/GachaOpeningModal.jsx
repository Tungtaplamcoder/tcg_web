import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Sparkles, MousePointerClick, AlertTriangle, RefreshCw, Gem, Crown, Sparkle, Scissors
} from 'lucide-react';
import api from '../../services/api';
import TiltCard from '../TiltCard';
import ProductImage from '../ProductImage';
import { playTear, playReveal, playTick, playPop, vibrate } from '../../utils/sfx';

/* ── Gacha rarity treatments (backend enum: COMMON/RARE/EPIC/LEGENDARY) ──
   Each tier carries its own radial-aura color story: the aura is a soft
   radial gradient (never a hard square glow), scaled to rarity. */
const GACHA_RARITY = {
  COMMON: {
    label: 'Common',
    tier: 1,
    icon: null,
    badge: 'from-slate-300 via-slate-400 to-slate-500',
    frame: 'linear-gradient(160deg, #e2e8f0, #94a3b8 45%, #cbd5e1 75%, #64748b)',
    aura: 'radial-gradient(closest-side, rgba(148,163,184,0.55), rgba(100,116,139,0.28) 55%, transparent 78%)',
    particles: ['#cbd5e1', '#e2e8f0', '#94a3b8', '#ffffff'],
    flash: 'rgba(226, 232, 240, 0.35)',
    headline: 'You pulled'
  },
  RARE: {
    label: 'Rare',
    tier: 2,
    icon: Sparkle,
    badge: 'from-indigo-400 via-violet-500 to-fuchsia-400',
    frame: 'linear-gradient(160deg, #818cf8, #a78bfa 45%, #e879f9 80%, #818cf8)',
    aura: 'radial-gradient(closest-side, rgba(139,92,246,0.75), rgba(167,139,250,0.38) 55%, transparent 78%)',
    particles: ['#a78bfa', '#818cf8', '#e879f9', '#ffffff'],
    flash: 'rgba(167, 139, 250, 0.5)',
    headline: 'Rare pull'
  },
  EPIC: {
    label: 'Epic',
    tier: 3,
    icon: Gem,
    badge: 'from-cyan-400 via-fuchsia-500 to-violet-500',
    frame: 'linear-gradient(120deg, #22d3ee, #d946ef 35%, #8b5cf6 65%, #22d3ee)',
    aura: 'radial-gradient(closest-side, rgba(217,70,239,0.8), rgba(139,92,246,0.42) 55%, transparent 78%)',
    particles: ['#22d3ee', '#d946ef', '#8b5cf6', '#f0abfc'],
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
    aura: 'radial-gradient(closest-side, rgba(233,196,106,0.85), rgba(249,115,22,0.4) 55%, transparent 78%)',
    particles: ['#e9c46a', '#ffd88a', '#d946ef', '#ffffff'],
    flash: 'rgba(255, 214, 130, 0.75)',
    headline: 'Legendary pull',
    spin: true
  }
};

const resolveGachaRarity = (rarity) => {
  const key = String(rarity || '').toUpperCase().trim();
  return GACHA_RARITY[key] || GACHA_RARITY.COMMON;
};

/* ── Pack geometry (true-3D box faces) — scaled ~38% vs the original
   (168×238 → 232×328) so the whole ceremony feels prominent ── */
const PACK_W = 232;
const PACK_H = 328;
const PACK_D = 46;
const FRAME_PAD = 3;
const REQUIRED_TAPS = 3;
const MIN_CHARGE_MS = 1400;
const TEAR_MS = 760;
const BURST_MS = 420;
const FLIP_DELAY_MS = 460;
const FLIP_MS = 1150;
const REVEAL_EXTRA_MS = 90;
const DEFAULT_GRADIENT = 'from-violet-600 via-fuchsia-600 to-pink-500';

const faceBase = {
  position: 'absolute',
  borderRadius: '10px',
  overflow: 'hidden',
  backfaceVisibility: 'hidden'
};

const isCssGradient = (g) => typeof g === 'string' && /^(linear|radial|conic)-gradient/i.test(g.trim());

/* ── FX helpers ── */
const EMBER_COLORS = ['#e9c46a', '#d946ef', '#22d3ee', '#ffffff'];
const ORBIT_COLORS = ['#22d3ee', '#d946ef', '#e9c46a', '#a78bfa', '#ffffff', '#f0abfc'];

let fxClock = 0;
const nextFxClock = () => {
  fxClock = (fxClock + 1) % 100000;
  return fxClock;
};

const makeParticles = (count, spread, prefix, palette) =>
  Array.from({ length: count }).map((_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = 80 + Math.random() * spread;
    return {
      id: `${prefix}${nextFxClock()}-${i}`,
      px: `${Math.cos(angle) * dist}px`,
      py: `${Math.sin(angle) * dist}px`,
      pc: palette[i % palette.length],
      size: 5 + Math.random() * 6,
      delay: `${Math.random() * 0.12}s`
    };
  });

const makeEmbers = (count) =>
  Array.from({ length: count }).map((_, i) => ({
    id: `e${nextFxClock()}-${i}`,
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

/* Ambient aura motes drifting around the revealed card — a slow, soft
   particle halo (never a hard-edged glow block). */
const makeAmbientMotes = (rarity, count = 14) =>
  Array.from({ length: count }).map((_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const dist = 120 + Math.random() * 90;
    return {
      id: `am${nextFxClock()}-${i}`,
      left: `${(50 + Math.cos(angle) * (dist / 5.2)).toFixed(1)}%`,
      top: `${(50 + Math.sin(angle) * (dist / 5.2)).toFixed(1)}%`,
      color: rarity.particles[i % rarity.particles.length],
      size: 3 + Math.random() * 5,
      dur: `${(2.6 + Math.random() * 2.6).toFixed(2)}s`,
      delay: `${(Math.random() * 2.4).toFixed(2)}s`,
      drift: `${(18 + Math.random() * 30).toFixed(0)}px`
    };
  });

/* Expanding ripple rings born on each pack tap */
const makeRipples = (count = 2) =>
  Array.from({ length: count }).map((_, i) => ({
    id: `r${nextFxClock()}-${i}`,
    dx: `${((Math.random() - 0.5) * 26).toFixed(0)}px`,
    dy: `${((Math.random() - 0.5) * 26).toFixed(0)}px`,
    size: 96 + i * 54 + Math.random() * 20,
    delay: `${(i * 0.09).toFixed(2)}s`
  }));

const GachaRarityBadge = ({ rarity, size = 'lg', sheen = false }) => {
  const meta = resolveGachaRarity(rarity);
  const Icon = meta.icon;
  const sizing = size === 'lg' ? 'text-[12px] px-3.5 py-1.5' : 'text-[10px] px-2.5 py-1';
  return (
    <span
      className={`relative inline-flex items-center gap-1.5 overflow-hidden rounded-full font-bold uppercase tracking-[0.16em] text-white shadow-lg ${sizing} ${
        sheen ? 'gacha-badge-sheen' : ''
      }`}
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
 * GachaOpeningModal — interactive unboxing FX for POST /api/v1/virtual-boxes/:id/open.
 *
 * Data: pulls render from `result.card.gachaCard` — the dedicated gacha
 * card pool (name / imageUrl / setCode / rarity), fully decoupled from the
 * retail shop inventory.
 *
 * Visual state flow:
 *   ready    → sealed 3D pack floating center; user must tap it 3 times
 *              (or hit the "Tear Pack" shortcut). Each tap fires a jolt
 *              shake, expanding ripple rings and a small spark burst.
 *   charging → 3rd tap: escalating 3D shake + orbiting motes + haptics
 *              while the weighted roll resolves (min anticipation window).
 *   tearing  → pack shake peaks, then a foil-tear split rips the pack in
 *              half and a dramatic light burst washes the stage as the
 *              packaging defocuses away.
 *   flipping → pulled card rises face-down, then a CSS 3D Y-flip
 *              (preserve-3d + backface-visibility) reveals the front.
 *   revealed → rarity radial aura + ambient particle halo, foil frame
 *              scaled by rarity, smooth subtle 3D tilt on hover,
 *              Done / Open Another CTAs.
 *   error    → friendly failure panel with retry.
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
  const [taps, setTaps] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [shakeHard, setShakeHard] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [bursts, setBursts] = useState([]);
  const [embers, setEmbers] = useState([]);
  const [ripples, setRipples] = useState([]);
  const [burstFlash, setBurstFlash] = useState(false);

  const phaseRef = useRef('ready');
  const busyRef = useRef(false);
  const tapsRef = useRef(0);
  const mountedRef = useRef(true);
  const timersRef = useRef([]);
  const joltRef = useRef(null);
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

  const gachaCard = result?.card?.gachaCard || null;
  const rarity = resolveGachaRarity(result?.card?.rarity || gachaCard?.rarity);
  const tier = rarity.tier;
  const cardName = gachaCard?.name || 'Mystery Card';
  const cardImage = gachaCard?.imageUrl || null;
  const cardSetCode = gachaCard?.setCode || null;
  const ambientMotes = useMemo(
    () => (phase === 'revealed' && !reducedMotion ? makeAmbientMotes(rarity, 12 + tier * 3) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, result, reducedMotion]
  );

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

  /* Restart the one-shot tap-jolt animation without remounting the 3D pack.
     --jolt scales the jolt amplitude with each successive tap. */
  const triggerJolt = useCallback(() => {
    const el = joltRef.current;
    if (!el || reducedMotion) return;
    el.style.setProperty('--jolt', (0.9 + tapsRef.current * 0.35).toFixed(2));
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = `gacha-jolt ${Math.round(320 + tapsRef.current * 70)}ms cubic-bezier(0.34, 1.56, 0.64, 1) both`;
  }, [reducedMotion]);

  const beginOpen = useCallback(async () => {
    if (busyRef.current || !boxId) return;
    const p = phaseRef.current;
    if (p !== 'ready' && p !== 'error') return;
    busyRef.current = true;
    /* hand the pack over to the charging shake classes */
    if (joltRef.current) joltRef.current.style.animation = '';
    setError('');
    setResult(null);
    setFlipped(false);
    setBursts([]);
    setEmbers([]);
    setRipples([]);
    setBurstFlash(false);
    setShakeHard(false);
    goto('charging');
    vibrate([8, 30, 8]);
    if (!reducedMotion) addTimer(() => { if (mountedRef.current) setShakeHard(true); }, 750);

    const startedAt = Date.now();
    try {
      const res = await api.post(`/virtual-boxes/${boxId}/open`);
      const data = res.data?.data;
      const wait = Math.max(0, MIN_CHARGE_MS - (Date.now() - startedAt));
      if (wait > 0) await sleep(wait);
      if (!mountedRef.current) return;

      const pullTier = resolveGachaRarity(data?.card?.rarity || data?.card?.gachaCard?.rarity).tier;
      const pullRarity = resolveGachaRarity(data?.card?.rarity || data?.card?.gachaCard?.rarity);

      /* ── Foil tear: jagged halves rip apart + dramatic light burst ── */
      playTear();
      vibrate(pullTier >= 3 ? [20, 30, 40] : [15]);
      if (!reducedMotion) {
        setBursts(makeParticles(10 + pullTier * 6, 170, 's', pullRarity.particles));
        setBurstFlash(true);
        addTimer(() => { if (mountedRef.current) setBurstFlash(false); }, BURST_MS + 200);
      }
      goto('tearing');

      await sleep(reducedMotion ? 180 : TEAR_MS);
      if (!mountedRef.current) return;

      /* Card rises face-down, then flips to reveal the pull */
      setResult(data);
      goto('flipping');
      const flipDelay = reducedMotion ? 120 : FLIP_DELAY_MS;
      addTimer(() => { if (mountedRef.current) setFlipped(true); }, flipDelay);
      addTimer(() => { if (mountedRef.current) playReveal(pullTier); }, flipDelay + 180);
      addTimer(() => {
        if (!mountedRef.current) return;
        vibrate(pullTier >= 4 ? [30, 40, 60, 40, 90] : pullTier === 3 ? [25, 35, 50] : [20, 30, 30]);
        if (!reducedMotion) {
          setBursts((prev) => [...prev, ...makeParticles(8 + pullTier * 10, 210 + pullTier * 34, 'b', pullRarity.particles)]);
          if (pullTier >= 3) setEmbers(makeEmbers(8 + pullTier * 4));
        }
        goto('revealed');
        if (onResultRef.current) onResultRef.current(data);
      }, reducedMotion ? flipDelay + 200 : flipDelay + FLIP_MS + REVEAL_EXTRA_MS);
    } catch (err) {
      console.error('Gacha open failed:', err.response?.status, err.response?.data?.error?.message || err.message);
      if (!mountedRef.current) return;
      setError(err.response?.data?.error?.message || 'Failed to open the box. Please try again.');
      goto('error');
    } finally {
      busyRef.current = false;
    }
  }, [boxId, goto, addTimer, sleep, reducedMotion]);

  /* One pack tap: jolt + ripples + sparks; the third tap starts the tear */
  const handleTap = useCallback(() => {
    if (busyRef.current || phaseRef.current !== 'ready') return;
    const next = Math.min(tapsRef.current + 1, REQUIRED_TAPS);
    tapsRef.current = next;
    setTaps(next);
    playPop();
    vibrate(next >= REQUIRED_TAPS ? [10, 30, 10] : 6 + next * 4);
    triggerJolt();
    if (!reducedMotion) {
      setRipples((prev) => [...prev.slice(-6), ...makeRipples(2)]);
      setBursts((prev) => [...prev.slice(-30), ...makeParticles(4 + next * 3, 70 + next * 20, 't', rarity.particles)]);
    }
    if (next >= REQUIRED_TAPS) beginOpen();
  }, [beginOpen, triggerJolt, reducedMotion, rarity]);

  /* Full ceremony replay from the sealed pack */
  const openAnother = useCallback(() => {
    if (busyRef.current) return;
    playTick();
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    tapsRef.current = 0;
    setTaps(0);
    setResult(null);
    setError('');
    setFlipped(false);
    setBursts([]);
    setEmbers([]);
    setRipples([]);
    setBurstFlash(false);
    setShakeHard(false);
    goto('ready');
  }, [goto]);

  const handleEscape = useCallback((e) => {
    if (e.key !== 'Escape') return;
    const p = phaseRef.current;
    if (p === 'charging' || p === 'tearing' || p === 'flipping') return;
    onCloseRef.current();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!open || !boxId) return undefined;
    busyRef.current = false;
    tapsRef.current = 0;
    goto('ready');
    setTaps(0);
    setResult(null);
    setError('');
    setBursts([]);
    setEmbers([]);
    setRipples([]);
    setBurstFlash(false);
    setFlipped(false);
    setShakeHard(false);

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    let auto = null;
    if (autoOpen) auto = setTimeout(() => beginOpen(), 650);

    return () => {
      if (auto) clearTimeout(auto);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      busyRef.current = false;
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, boxId, autoOpen, goto, handleEscape, beginOpen]);

  if (!open || !boxId) return null;

  const animating = phase === 'charging' || phase === 'tearing' || phase === 'flipping';
  const backdropBlur = phase === 'tearing' ? 18 : phase === 'revealed' || phase === 'flipping' ? 14 : 10;
  const shakeCls = phase === 'charging' && !reducedMotion ? (shakeHard ? 'gacha-shake-hard' : 'gacha-shake') : '';
  const frontFace = packFace({ ...faceBase, inset: 0, transform: `translateZ(${PACK_D / 2}px)`, boxShadow: '0 28px 56px -16px rgba(0,0,0,0.55)' }, 'sheen-sweep');
  const sideFace = packFace({ ...faceBase, top: 0, right: 0, width: PACK_D, height: PACK_H, transform: `rotateY(90deg) translateZ(${PACK_W - PACK_D / 2}px)` });
  const topFace = packFace({ ...faceBase, top: 0, left: 0, width: PACK_W, height: PACK_D, transform: `rotateX(90deg) translateZ(${PACK_D / 2}px)`, border: '1px solid rgba(255,255,255,0.25)' });

  const tapHint = taps <= 0
    ? `Click the pack ${REQUIRED_TAPS}× to crack the seal`
    : taps === 1
      ? 'Nice hit — keep going!'
      : 'One more click to tear it open!';

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

      {/* Rarity radial aura — smooth ambient bloom tailored to the pull */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-700 ${
          phase === 'revealed' || phase === 'flipping'
            ? `animate-aura-pulse opacity-90 ${!reducedMotion && tier >= 3 ? 'gacha-aura-sway' : ''}`
            : 'opacity-25'
        }`}
        style={{ background: rarity.aura, filter: 'blur(28px)' }}
      />

      {/* Ambient aura motes drifting around the revealed card */}
      {(phase === 'revealed' || phase === 'flipping') && !reducedMotion && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {ambientMotes.map((m) => (
            <span
              key={m.id}
              className="gacha-ambient-mote"
              style={{
                left: m.left,
                top: m.top,
                width: m.size,
                height: m.size,
                background: `radial-gradient(circle, ${m.color}, transparent 75%)`,
                boxShadow: `0 0 10px ${m.color}`,
                animationDuration: m.dur,
                animationDelay: m.delay,
                '--mdrift': m.drift
              }}
            />
          ))}
        </div>
      )}

      {/* God rays + flash + shockwave on high-tier reveals */}
      {phase === 'revealed' && tier >= 3 && !reducedMotion && <div className="pack-god-rays" />}
      {phase === 'revealed' && !reducedMotion && tier >= 2 && (
        <div className="pack-flash" style={{ '--flash-c': rarity.flash }} />
      )}
      {phase === 'revealed' && tier === 4 && !reducedMotion && <div className="pack-shockwave" />}

      {/* Foil-tear light burst — a dramatic radial wash as the pack splits */}
      {burstFlash && !reducedMotion && (
        <div
          aria-hidden="true"
          className="gacha-light-burst"
          style={{ '--flash-c': 'rgba(255, 244, 214, 0.95)', '--burst-ms': `${BURST_MS}ms` }}
        />
      )}

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

      <div className="relative w-full max-w-2xl">
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
              <button onClick={beginOpen} className="btn-primary !px-6 !py-2.5 text-sm">
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
        ) : phase === 'ready' || phase === 'charging' ? (
          <div className="relative flex flex-col items-center">
            {/* Charge aura — brightens with every tap */}
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute left-1/2 top-[44%] h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-violet-500/70 via-fuchsia-500/60 to-cyan-400/60 blur-[70px] ${
                phase === 'charging' && !reducedMotion ? 'gacha-glow-pulse' : ''
              }`}
              style={phase === 'ready' ? { opacity: 0.35 + taps * 0.16, transition: 'opacity 0.35s ease' } : undefined}
            />

            {/* Orbiting glow motes while the roll resolves */}
            {phase === 'charging' && !reducedMotion && (
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
            <div aria-hidden="true" className="absolute left-1/2 top-[86%] h-7 w-52 -translate-x-1/2 rounded-[100%] bg-black/40 blur-md" />

            <div className="relative">
              {/* Tap ripple rings */}
              {!reducedMotion && (
                <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-0 w-0">
                  {ripples.map((r) => (
                    <span
                      key={r.id}
                      className="gacha-ripple"
                      style={{ '--rs': `${r.size}px`, '--rdx': r.dx, '--rdy': r.dy, animationDelay: r.delay }}
                    />
                  ))}
                </div>
              )}

              <button
                onClick={handleTap}
                disabled={phase !== 'ready'}
                aria-label={`Tear open ${boxName} — click ${REQUIRED_TAPS} times`}
                className={`relative z-10 block cursor-pointer rounded-3xl pb-6 pt-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70 ${
                  phase === 'ready' ? '' : 'cursor-wait'
                }`}
              >
                <div className="box3d-stage">
                  <div className={phase === 'ready' && !reducedMotion ? 'animate-tcg-float' : ''} style={{ animationDuration: '4.5s' }}>
                    <div
                      ref={joltRef}
                      className={`will-change-transform ${shakeCls}`}
                    >
                      <div
                        className="box3d"
                        style={{ width: PACK_W, height: PACK_H, transform: 'rotateX(-9deg) rotateY(26deg)' }}
                      >
                        {/* front */}
                        <div {...frontFace}>
                          <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
                          <div className="absolute inset-x-0 top-2.5 h-1.5 rounded-full bg-white/25 mx-2.5" />
                          <div className="absolute inset-x-0 bottom-2.5 h-1.5 rounded-full bg-black/20 mx-2.5" />
                          {boxImageUrl ? (
                            <ProductImage
                              src={boxImageUrl}
                              alt=""
                              className="absolute inset-0 h-full w-full object-contain p-2"
                              fallbackClassName="absolute inset-0"
                              iconClassName="h-10 w-10 text-white/90"
                              label={boxName}
                            />
                          ) : null}
                          <div className="absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b from-white/35 to-transparent" />
                          {!boxImageUrl && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3 text-center">
                              <Sparkles className="h-10 w-10 text-white/90 drop-shadow" />
                              <p className="font-display text-sm font-bold leading-tight text-white drop-shadow">{boxName}</p>
                              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">Virtual Pack · 1 Card</p>
                            </div>
                          )}
                          {boxImageUrl && (
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-2 pt-6 text-center">
                              <p className="font-display text-sm font-bold leading-tight text-white drop-shadow">{boxName}</p>
                              <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/70">Virtual Pack · 1 Card</p>
                            </div>
                          )}
                          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-700 shadow ring-1 ring-violet-200">
                            {taps === 0 ? 'Sealed' : 'Cracking…'}
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
            </div>

            {phase === 'ready' ? (
              <>
                {/* Tap progress */}
                <div className="relative z-10 mt-2 flex items-center gap-2" aria-label={`${REQUIRED_TAPS - taps} more ${REQUIRED_TAPS - taps === 1 ? 'click' : 'clicks'} to tear`}>
                  {Array.from({ length: REQUIRED_TAPS }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        i < taps
                          ? 'w-6 bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 shadow-[0_0_12px_rgba(139,92,246,0.9)]'
                          : 'w-2 bg-white/25'
                      }`}
                    />
                  ))}
                </div>
                <span className="relative z-10 mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/25 backdrop-blur animate-tcg-pulse-ring">
                  <MousePointerClick className="h-4 w-4 text-aura-gold" />
                  {tapHint}
                </span>
                <button
                  type="button"
                  onClick={beginOpen}
                  className="btn-primary relative z-10 mt-3 !px-6 !py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70"
                >
                  <Scissors className="h-4 w-4" /> Tear Pack
                </button>
              </>
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
                  className={`pack-tear-jagged absolute h-40 w-72 opacity-95 ${isCssPack ? '' : `bg-gradient-to-br ${packStops}`}`}
                  style={{ ...(isCssPack ? { backgroundImage: boxGradient } : {}), animation: `gacha-tear-top ${TEAR_MS}ms cubic-bezier(0.5, 0, 0.75, 0.4) forwards`, top: 0 }}
                />
                <div
                  className={`pack-tear-jagged-bottom absolute h-40 w-72 opacity-95 ${isCssPack ? '' : `bg-gradient-to-br ${packStops}`}`}
                  style={{ ...(isCssPack ? { backgroundImage: boxGradient } : {}), animation: `gacha-tear-bottom ${TEAR_MS}ms cubic-bezier(0.5, 0, 0.75, 0.4) forwards`, top: 66 }}
                />
              </div>
            )}

            {/* Pulled card: rises face-down, 3D Y-flip reveals the front,
                smooth subtle 3D tilt on hover after reveal */}
            {(phase === 'flipping' || phase === 'revealed') && (
              <div className="relative z-10 pack-card-rise">
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute left-1/2 top-1/2 h-[115%] w-[115%] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-700 ${
                    phase === 'revealed' ? 'animate-aura-pulse opacity-90' : 'opacity-40'
                  }`}
                  style={{ background: rarity.aura, filter: 'blur(22px)' }}
                />
                <TiltCard
                  max={10}
                  scale={1.03}
                  foil
                  spotlight
                  stiffness={140}
                  damping={26}
                  rarity={result?.card?.rarity || gachaCard?.rarity}
                  className="relative rounded-[1.4rem] shadow-[0_36px_80px_-20px_rgba(124,58,237,0.55)]"
                >
                  <div className="gacha-flip-scene">
                    <div className={`gacha-flipper ${flipped ? 'is-flipped' : ''}`}>
                      {/* BACK — the face-down mystery card */}
                      <div className="gacha-flip-face gacha-flip-back">
                        <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-[calc(1.4rem-2px)] bg-gradient-to-br from-[#1d1533] via-[#0d0a18] to-[#181026] ring-1 ring-white/15">
                          <div aria-hidden="true" className="absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                          <div aria-hidden="true" className="absolute inset-2 rounded-xl border border-white/15" />
                          <div aria-hidden="true" className="sheen-sweep absolute inset-0" />
                          <Sparkles className="relative h-12 w-12 text-white/80 drop-shadow" />
                          <p className="relative font-display text-sm font-bold uppercase tracking-[0.3em] text-white/75">
                            TCG
                          </p>
                          <p className="relative text-[9px] font-semibold uppercase tracking-[0.22em] text-white/45">
                            Mystery Pull
                          </p>
                        </div>
                      </div>

                      {/* FRONT — the revealed pull with rarity foil frame.
                          Card art keeps its natural vertical aspect ratio
                          (object-contain) — no squeeze, no stretch. */}
                      <div className="gacha-flip-face gacha-flip-front">
                        <div className="relative h-full overflow-hidden rounded-[1.4rem]" style={{ padding: FRAME_PAD }}>
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

                          <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-b from-[#17131f] to-[#0b0a12]" style={{ borderRadius: `calc(1.4rem - ${FRAME_PAD}px)` }}>
                            <div className="relative min-h-0 flex-1 p-3">
                              <div className="absolute left-5 top-5 z-20" style={{ transform: 'translateZ(28px)' }}>
                                <GachaRarityBadge rarity={result?.card?.rarity || gachaCard?.rarity} size="sm" />
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
                                {cardSetCode ? `${cardSetCode} · ` : ''}from {boxName}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TiltCard>
              </div>
            )}

            {/* Pull summary + actions */}
            {(phase === 'flipping' || phase === 'revealed') && (
              <div className={`mt-6 text-center ${phase === 'revealed' ? 'animate-tcg-reveal' : 'opacity-0'}`}>
                <div
                  className={`inline-block rounded-full ${phase === 'revealed' && !reducedMotion ? 'gacha-badge-glow' : ''}`}
                  style={{ '--badge-glow': rarity.flash }}
                >
                  <GachaRarityBadge rarity={result?.card?.rarity || gachaCard?.rarity} sheen={phase === 'revealed'} />
                </div>
                <p className={`mt-3 font-display text-2xl font-bold drop-shadow ${tier === 4 ? 'text-gradient-sweep' : 'text-white'}`}>
                  {tier >= 3 ? rarity.headline : 'Congrats!'}
                </p>
                <p className="mt-0.5 text-sm text-white/75">{cardName}</p>

                {phase === 'revealed' && (
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                    <button
                      onClick={() => { playTick(); onClose(); }}
                      className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70"
                    >
                      Done
                    </button>
                    <button onClick={openAnother} className="btn-primary !px-6 !py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70">
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Open Another
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GachaOpeningModal;
