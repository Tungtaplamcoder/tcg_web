import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X, Sparkles, AlertTriangle, RefreshCw, Gem, Crown, Sparkle, Scissors, ImageOff, MousePointerClick
} from 'lucide-react';
import api from '../../services/api';
import { API_URL } from '../../config/env';
import ProductImage from '../ProductImage';
import { playTear, playReveal, playTick, playPop, vibrate } from '../../utils/sfx';
import { useLanguage } from '../../i18n/LanguageContext';

/* ── Gacha rarity treatments (backend enum: COMMON/RARE/EPIC/LEGENDARY) ──
    Strict pastel-pink / neutral family — NO warm tones (amber/gold/orange).
    Each tier climbs the pink → fuchsia ramp with a cool cyan holo accent on
    the top tier only. label/headline are i18n keys resolved at render. */
const GACHA_RARITY = {
  COMMON: {
    labelKey: 'gacha.rarity.COMMON',
    headlineKey: 'gacha.headline.COMMON',
    tier: 1,
    icon: null,
    badge: 'from-slate-300 via-slate-400 to-slate-500',
    frame: 'linear-gradient(160deg, #e2e8f0, #94a3b8 45%, #cbd5e1 75%, #64748b)',
    aura: 'radial-gradient(closest-side, rgba(203,213,225,0.55), rgba(148,163,184,0.28) 55%, transparent 78%)',
    particles: ['#cbd5e1', '#e2e8f0', '#94a3b8', '#ffffff'],
    shadow: 'drop-shadow(0 20px 28px rgba(0, 0, 0, 0.55))'
  },
  RARE: {
    labelKey: 'gacha.rarity.RARE',
    headlineKey: 'gacha.headline.RARE',
    tier: 2,
    icon: Sparkle,
    badge: 'from-pink-300 via-pink-400 to-pink-500',
    frame: 'linear-gradient(160deg, #f9a8d4, #f472b6 45%, #ec4899 80%, #f9a8d4)',
    aura: 'radial-gradient(closest-side, rgba(244,114,182,0.75), rgba(236,72,153,0.38) 55%, transparent 78%)',
    particles: ['#f9a8d4', '#f472b6', '#ec4899', '#ffffff'],
    shadow: 'drop-shadow(0 20px 30px rgba(236, 72, 153, 0.42))'
  },
  EPIC: {
    labelKey: 'gacha.rarity.EPIC',
    headlineKey: 'gacha.headline.EPIC',
    tier: 3,
    icon: Gem,
    badge: 'from-pink-500 via-fuchsia-500 to-fuchsia-600',
    frame: 'linear-gradient(120deg, #f472b6, #ec4899 35%, #d946ef 65%, #f472b6)',
    aura: 'radial-gradient(closest-side, rgba(217,70,239,0.8), rgba(236,72,153,0.42) 55%, transparent 78%)',
    particles: ['#f472b6', '#d946ef', '#ec4899', '#ffffff'],
    shadow: 'drop-shadow(0 24px 34px rgba(217, 70, 239, 0.5))'
  },
  LEGENDARY: {
    labelKey: 'gacha.rarity.LEGENDARY',
    headlineKey: 'gacha.headline.LEGENDARY',
    tier: 4,
    icon: Crown,
    badge: 'from-pink-500 via-fuchsia-500 to-cyan-400',
    frame: 'conic-gradient(from 210deg, #fdf2f8, #f472b6 18%, #d946ef 38%, #22d3ee 58%, #ec4899 78%, #fdf2f8)',
    aura: 'radial-gradient(closest-side, rgba(219,39,119,0.85), rgba(217,70,239,0.42) 55%, transparent 78%)',
    particles: ['#f472b6', '#d946ef', '#22d3ee', '#ffffff'],
    shadow: 'drop-shadow(0 26px 40px rgba(219, 39, 119, 0.55))'
  }
};

const resolveGachaRarity = (rarity) => {
  const key = String(rarity || '').toUpperCase().trim();
  return GACHA_RARITY[key] || GACHA_RARITY.COMMON;
};

const REQUIRED_TAPS = 3;
const MIN_CHARGE_MS = 1400;
const DEFAULT_GRADIENT = 'from-violet-600 via-fuchsia-600 to-pink-500';

const isCssGradient = (g) => typeof g === 'string' && /^(linear|radial|conic)-gradient/i.test(g.trim());

/* ── Pack geometry — the frameless pack art floats at pack scale ── */
const PACK_W = 232;
const PACK_H = 328;

/* ── Card art binding — dynamic image resolution for the revealed pull.
    Proxies relative API paths (/uploads/...) to the backend origin so art
    still resolves when the backend lives on another origin. ── */
const resolveCardImage = (raw) => {
  const url = String(raw || '').trim();
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  if (/^\/api\//i.test(path)) return `${API_URL.replace(/\/api\/v\d+$/i, '')}${path}`;
  if (/^\/uploads\//i.test(path) && /^https?:/i.test(API_URL)) return `${API_URL}${path}`;
  return path;
};

/* ── FX helpers — deterministic particle field for reveal sparks ── */
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
  const { t } = useLanguage();
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
        {t(meta.labelKey)}
      </span>
    </span>
  );
};

/**
 * GachaOpeningModal — interactive unboxing for POST /api/v1/virtual-boxes/:id/open.
 *
 * Data binding (explicit backend payload map):
 *   data.card.gachaCard  → { name, imageUrl, setCode, rarity }
 *   data.card           → flat fallback (rarity, image_url/image variants)
 *
 * Visual state flow (clean keyframe reveals — no 3D flip DOM states):
 *   ready    → sealed pack floats over the dark ambient backdrop; 3 taps
 *              (or "Tear Pack") jolt it with ripple rings + spark bursts.
 *   charging → escalating shake + orbiting motes while the weighted roll
 *              resolves (min anticipation window).
 *   revealed → the booster pack artwork unmounts and the pulled card
 *              zooms in (gacha-zoom-in keyframe) with a rarity-matched
 *              radial aura, ambient particle halo, foil frame scaled by
 *              rarity, Done / Open Another CTAs.
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
  const { t } = useLanguage();
  const [phase, setPhase] = useState('ready');
  const [taps, setTaps] = useState(0);
  const [pullResult, setPullResult] = useState(null);
  const [error, setError] = useState('');
  const [shakeHard, setShakeHard] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [bursts, setBursts] = useState([]);
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

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);

  const reducedMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );

  /* ── Explicit backend payload mapping ──
     The open endpoint returns { card: { rarity, gachaCard: { name,
     imageUrl, setCode, rarity } } }. Bind the gacha pool record first,
     then fall back to any flat card fields, then chase image variants
     across camel/snake casing so art renders dynamically no matter
     which serializer produced the payload. */
  const gachaCard = pullResult?.card?.gachaCard || null;
  const revealedCard = gachaCard || pullResult?.card || null;
  const rarity = resolveGachaRarity(revealedCard?.rarity || pullResult?.card?.rarity);
  const tier = rarity.tier;
  const cardName = revealedCard?.name || 'Mystery Card';
  const cardImg = resolveCardImage(
    revealedCard?.imageUrl || revealedCard?.image_url || revealedCard?.image
  );
  const cardSetCode = revealedCard?.setCode || revealedCard?.set_name || null;
  const hasCardImage = Boolean(cardImg);
  const showImage = hasCardImage && !imageFailed;
  const isRevealed = phase === 'revealed';

  const isCssPack = isCssGradient(boxGradient);
  const packStops = !isCssPack && typeof boxGradient === 'string' && boxGradient.trim() ? boxGradient.trim() : DEFAULT_GRADIENT;

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

  /* Restart the one-shot tap-jolt animation without remounting the pack.
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
    if (joltRef.current) joltRef.current.style.animation = '';
    setError('');
    setPullResult(null);
    setImageFailed(false);
    setBursts([]);
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

      const pullTier = resolveGachaRarity(
        data?.card?.gachaCard?.rarity || data?.card?.rarity
      ).tier;
      const pullRarity = resolveGachaRarity(data?.card?.gachaCard?.rarity || data?.card?.rarity);

      /* ── Foil tear: spark burst + light flash as the pack splits ── */
      playTear();
      vibrate(pullTier >= 3 ? [20, 30, 40] : [15]);
      if (!reducedMotion) {
        setBursts(makeParticles(10 + pullTier * 6, 170, 's', pullRarity.particles));
        setBurstFlash(true);
        addTimer(() => { if (mountedRef.current) setBurstFlash(false); }, 620);
      }

      /* ── Reveal: bind the payload, unmount the pack, zoom the card in.
          The clean keyframe reveal (gacha-zoom-in) replaces the old 3D
          flip DOM states — reliable, no backface/preserve-3d edge cases. */
      setPullResult(data);
      goto('revealed');
      playReveal(pullTier);
      vibrate(pullTier >= 4 ? [30, 40, 60, 40, 90] : pullTier === 3 ? [25, 35, 50] : [20, 30, 30]);
      if (!reducedMotion) {
        addTimer(() => {
          if (!mountedRef.current) return;
          setBursts((prev) => [...prev, ...makeParticles(8 + pullTier * 10, 210 + pullTier * 34, 'b', pullRarity.particles)]);
        }, 260);
      }
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
  }, [beginOpen, triggerJolt, reducedMotion]);

  /* Full ceremony replay from the sealed pack */
  const openAnother = useCallback(() => {
    if (busyRef.current) return;
    playTick();
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    tapsRef.current = 0;
    setTaps(0);
    setPullResult(null);
    setError('');
    setImageFailed(false);
    setBursts([]);
    setRipples([]);
    setBurstFlash(false);
    setShakeHard(false);
    goto('ready');
  }, [goto]);

  const handleEscape = useCallback((e) => {
    if (e.key !== 'Escape') return;
    const p = phaseRef.current;
    if (p === 'charging') return;
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
    setPullResult(null);
    setError('');
    setBursts([]);
    setRipples([]);
    setBurstFlash(false);
    setImageFailed(false);
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

  const animating = phase === 'charging';
  const backdropBlur = isRevealed ? 'pb-blur-2' : 'pb-blur-1';
  const shakeCls = phase === 'charging' && !reducedMotion ? (shakeHard ? 'gacha-shake-hard' : 'gacha-shake') : '';

  const tapHint = taps <= 0
    ? t('gacha.tapHintZero', { count: REQUIRED_TAPS })
    : taps === 1
      ? t('gacha.tapHintOne')
      : t('gacha.tapHintTwo');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t('gacha.openNamed', { name: boxName })} data-testid="gacha-modal">
      {/* Depth-of-field backdrop */}
      <div
        className={`absolute inset-0 animate-tcg-fade-in ${backdropBlur}`}
        style={{ background: 'rgba(4, 4, 10, 0.8)' }}
        onClick={() => { if (!animating) onClose(); }}
      />

      {/* Rarity radial aura — smooth ambient bloom tailored to the pull */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-700 ${
          isRevealed
            ? `animate-aura-pulse opacity-90 ${!reducedMotion && tier >= 3 ? 'gacha-aura-sway' : ''}`
            : 'opacity-25'
        }`}
        style={{ background: rarity.aura, filter: 'blur(28px)' }}
      />

      {/* Foil-tear light burst — a dramatic radial wash as the pack splits */}
      {burstFlash && !reducedMotion && (
        <div
          aria-hidden="true"
          className="gacha-light-burst"
          style={{ '--flash-c': 'rgba(253, 242, 248, 0.95)', '--burst-ms': '420ms' }}
        />
      )}

      {/* Particle bursts */}
      {!reducedMotion && (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {bursts.map((p) => (
            <span
              key={p.id}
              className="pack-particle"
              style={{ '--px': p.px, '--py': p.py, '--pc': p.pc, width: p.size, height: p.size, animationDelay: p.delay }}
            />
          ))}
        </div>
      )}

      <div className="relative flex h-full w-full max-w-2xl flex-col">
        {/* Header — strictly centered at the top edge */}
        <header className="relative flex h-12 shrink-0 items-center justify-center">
          <p className="text-center font-display text-sm font-bold uppercase tracking-[0.18em] text-white/70">{boxName}</p>
          {!animating && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="glass-dark absolute right-0 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/90 transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </header>

        {/* Content column */}
        <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center">
        {phase === 'error' ? (
          <div className="glass-panel mx-auto max-w-sm rounded-2xl p-7 text-center animate-tcg-scale-in">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-400/15 ring-1 ring-pink-300/30">
              <AlertTriangle className="h-7 w-7 text-pink-300" />
            </span>
            <h3 className="mt-4 font-display text-lg font-bold text-white">{t('gacha.openingFailed')}</h3>
            <p className="mt-1.5 text-sm text-white/70">{error}</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button onClick={beginOpen} className="btn-primary !px-6 !py-2.5 text-sm">
                <RefreshCw className="mr-2 h-4 w-4" /> {t('common.tryAgain')}
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/10 px-6 py-2.5 text-sm font-semibold text-white backdrop-blur-sm md:backdrop-blur transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        ) : phase === 'ready' || phase === 'charging' ? (
          <div className="relative flex flex-col items-center">
            {/* ── Sealed pack — frameless render floating over the backdrop ── */}
            <div className="relative">
              {/* Charge aura — brightens with every tap */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary-600/70 via-fuchsia-500/60 to-pink-400/60 blur-[70px] ${
                  phase === 'charging' && !reducedMotion ? 'gacha-glow-pulse' : ''
                }`}
                style={phase === 'ready' ? { opacity: 0.35 + taps * 0.16, transition: 'opacity 0.35s ease' } : undefined}
              />

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
                data-testid="gacha-pack"
                aria-label={t('gacha.tapAria', { name: boxName, count: REQUIRED_TAPS })}
                className={`relative z-10 block cursor-pointer rounded-3xl p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70 ${
                  phase === 'ready' ? '' : 'cursor-wait'
                }`}
              >
                <div
                  className={`${phase === 'ready' && !reducedMotion ? 'animate-tcg-float gpu-motion' : ''}`}
                  style={{ animationDuration: '4.5s' }}
                >
                  <div ref={joltRef} className={`gpu-motion ${shakeCls}`}>
                    <div className="vb-pack-float relative flex items-center justify-center" style={{ width: PACK_W, height: PACK_H }}>
                      {boxImageUrl ? (
                        <ProductImage
                          src={boxImageUrl}
                          alt={boxName}
                          className="max-h-full w-auto max-w-full object-contain"
                          fallbackClassName="h-full w-full rounded-2xl"
                          iconClassName="h-12 w-12 text-white/90"
                          label={boxName}
                        />
                      ) : (
                        <div
                          className={`relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl ring-1 ring-white/25 ${isCssPack ? '' : `bg-gradient-to-br ${packStops}`}`}
                          style={isCssPack ? { backgroundImage: boxGradient } : undefined}
                        >
                          <div aria-hidden="true" className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
                          <Sparkles className="relative h-10 w-10 text-white/90 drop-shadow" />
                          <p className="relative px-4 text-center font-display text-sm font-bold leading-tight text-white drop-shadow">{boxName}</p>
                          <p className="relative text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">{t('gacha.virtualPack')}</p>
                        </div>
                      )}
                      {/* Seal state chip — rides the pack corner */}
                      <span className="absolute right-0 top-0 z-10 inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-700 shadow ring-1 ring-violet-200">
                        {taps === 0 ? t('gacha.sealed') : t('gacha.cracking')}
                      </span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Contact shadow */}
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-7 left-1/2 h-7 w-52 -translate-x-1/2 rounded-[100%] bg-black/40 blur-md" />
            </div>

            {/* Controls */}
            {phase === 'ready' ? (
              <div className="relative z-10 mt-10 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2" aria-label={`${REQUIRED_TAPS - taps} more ${REQUIRED_TAPS - taps === 1 ? 'click' : 'clicks'} to tear`}>
                  {Array.from({ length: REQUIRED_TAPS }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] ${
                        i < taps
                          ? 'w-7 bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400 shadow-[0_0_12px_rgba(139,92,246,0.9)]'
                          : 'w-4 bg-white/25'
                      }`}
                    />
                  ))}
                </div>
                <span className="glass-pill inline-flex items-center gap-2 px-4 py-2 text-[13px] font-semibold animate-tcg-pulse-ring">
                  <MousePointerClick className="h-3.5 w-3.5 text-pink-200" />
                  {tapHint}
                </span>
                <button
                  type="button"
                  onClick={beginOpen}
                  className="btn-primary !px-6 !py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70"
                >
                  <Scissors className="h-4 w-4" /> {t('gacha.tearPack')}
                </button>
              </div>
            ) : (
              <span className="relative z-10 mt-9 inline-flex items-center gap-2 text-sm font-semibold text-white/80" aria-live="polite">
                <RefreshCw className="h-4 w-4 animate-spin text-pink-200" />
                {t('gacha.rolling')}
              </span>
            )}
          </div>
        ) : (
          /* ── Revealed pull — the pack has unmounted; the card zooms in
              with a clean keyframe reveal (no 3D flip DOM states). ── */
          <div className="relative flex flex-col items-center" data-testid="gacha-reveal">
            <div className="relative z-10 gacha-zoom-in">
              {/* Dynamic rarity glow behind the card */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-95 animate-aura-pulse"
                style={{ background: rarity.aura, filter: 'blur(24px)' }}
              />

              {/* Foil frame: flowing (Epic), rotating metallic (Legendary) */}
              <div className="relative rounded-[1.4rem] p-[3px]" style={{ filter: rarity.shadow }}>
                {rarity.tier === 4 && !reducedMotion ? (
                  <div aria-hidden="true" className="gacha-frame-spin absolute left-1/2 top-1/2 aspect-square w-[240%]" style={{ background: rarity.frame }} />
                ) : (
                  <div
                    aria-hidden="true"
                    className={`absolute inset-0 rounded-[1.4rem] ${rarity.tier === 3 && !reducedMotion ? 'gacha-frame-flow' : ''}`}
                    style={{ background: rarity.frame }}
                  />
                )}

                <div className="relative flex w-full max-w-[320px] flex-col overflow-hidden rounded-[1.3rem] bg-gradient-to-b from-[#17131f] to-[#0b0a12]">
                  <div className="relative min-h-0 flex-1 p-3">
                    <div className="absolute left-4 top-4 z-20">
                      <GachaRarityBadge rarity={revealedCard?.rarity} size="sm" />
                    </div>
                    <div className="relative mt-8 flex w-full items-center justify-center">
                      {showImage ? (
                        <img
                          src={cardImg}
                          alt={revealedCard?.name || 'Revealed Card'}
                          className="w-full max-w-[320px] h-auto rounded-xl shadow-2xl border border-white/20 animate-tcg-zoom-in duration-300"
                          referrerPolicy="no-referrer"
                          onError={() => { setImageFailed(true); }}
                        />
                      ) : (
                        <div
                          role="img"
                          aria-label={`${cardName} — card image unavailable`}
                          className="flex h-64 w-full max-w-[320px] flex-col items-center justify-center gap-2 rounded-xl bg-[#241a38]/80 ring-1 ring-white/10"
                        >
                          <ImageOff className="h-10 w-10 text-white/50" aria-hidden="true" />
                          <p className="px-4 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">
                            {t('gacha.cardImageUnavailable')}
                          </p>
                          <p className="px-4 text-center font-display text-[13px] font-bold tracking-tight text-white/85">
                            {cardName}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-4 pb-4 pt-4 text-center">
                    <p className="truncate font-display text-[15px] font-bold tracking-tight text-white">{cardName}</p>
                    <p className="mt-1 truncate text-[11px] font-medium tracking-wide text-white/55">
                      {cardSetCode ? `${cardSetCode} · ` : ''}{t('gacha.fromBox', { name: boxName })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pull summary + actions */}
            <div className="mt-6 text-center animate-tcg-reveal">
              <div
                className={`inline-block rounded-full ${!reducedMotion ? 'gacha-badge-glow' : ''}`}
                style={{ '--badge-glow': rarity.aura }}
              >
                <GachaRarityBadge rarity={revealedCard?.rarity} sheen />
              </div>
              <p className={`mt-3.5 font-display text-2xl font-extrabold tracking-tight drop-shadow ${tier === 4 ? 'text-gradient-sweep' : 'text-white'}`}>
                {tier >= 3 ? t(rarity.headlineKey) : t('gacha.congrats')}
              </p>
              <p className="mt-1.5 text-[15px] font-medium text-white/80">{cardName}</p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => { playTick(); onClose(); }}
                  data-testid="gacha-done"
                  className="gacha-cta-ghost inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold"
                >
                  {t('gacha.done')}
                </button>
                <button onClick={openAnother} data-testid="gacha-open-another" className="btn-primary !px-6 !py-2.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-aura-cyan/70">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {t('gacha.openAnother')}
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default GachaOpeningModal;
