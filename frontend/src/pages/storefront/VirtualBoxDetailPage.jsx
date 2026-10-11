import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Layers,
  Package,
  PackageOpen,
  Percent,
  ShieldCheck,
  Sparkles,
  Tag
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useLanguage } from '../../i18n/LanguageContext';
import ProductImage from '../../components/ProductImage';
import GachaOpeningModal from '../../components/gacha/GachaOpeningModal';
import { boxBackground } from '../../utils/boxBackground';

/* ── Rarity presentation — strict pastel-pink / neutral family.
   No warm tones (orange/gold/yellow): the four tiers climb the pink →
   fuchsia ramp while Common stays a neutral silver. Tier letters follow
   the collectible C / R / SR / UR shorthand used in the odds panel. ── */
const RARITY_META = {
  COMMON: {
    tier: 'C',
    labelKey: 'gacha.rarity.COMMON',
    badge: 'from-neutral-300 via-neutral-400 to-neutral-500',
    chip: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700/60 dark:text-neutral-100',
    glow: 'rgba(212, 212, 216, 0.55)'
  },
  RARE: {
    tier: 'R',
    labelKey: 'gacha.rarity.RARE',
    badge: 'from-pink-300 via-pink-400 to-pink-500',
    chip: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-200',
    glow: 'rgba(244, 114, 182, 0.6)'
  },
  EPIC: {
    tier: 'SR',
    labelKey: 'gacha.rarity.EPIC',
    badge: 'from-pink-500 via-fuchsia-500 to-pink-400',
    chip: 'bg-pink-100 text-pink-700 dark:bg-fuchsia-500/25 dark:text-fuchsia-100',
    glow: 'rgba(236, 72, 153, 0.65)'
  },
  LEGENDARY: {
    tier: 'UR',
    labelKey: 'gacha.rarity.LEGENDARY',
    badge: 'from-pink-600 via-fuchsia-500 to-pink-400',
    chip: 'bg-pink-100 text-pink-700 dark:bg-pink-500/30 dark:text-pink-100',
    glow: 'rgba(219, 39, 119, 0.7)'
  }
};

const RARITY_ORDER = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

const resolveRarity = (rarity) => {
  const key = String(rarity || '').toUpperCase().trim();
  return { key: RARITY_META[key] ? key : 'COMMON', ...(RARITY_META[key] || RARITY_META.COMMON) };
};

/* Deterministic odds ordering: highest chance first (C → R → SR → UR for a
   balanced box), then rarity tier as the stable tie-breaker. */
const orderRates = (dropRates = []) =>
  [...(dropRates || [])]
    .map((entry) => ({
      rarity: RARITY_META[String(entry?.rarity).toUpperCase()] ? String(entry.rarity).toUpperCase() : 'COMMON',
      rate: Number(entry?.rate) || 0
    }))
    .sort((a, b) => b.rate - a.rate || RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

const RarityBadge = ({ rarity, size = 'md' }) => {
  const { t } = useLanguage();
  const meta = resolveRarity(rarity);
  const sizing = size === 'lg' ? 'px-3 py-1 text-[11px]' : 'px-2.5 py-0.5 text-[10px]';
  return (
    <span
      className={`inline-flex items-center rounded-full bg-gradient-to-r ${meta.badge} font-bold uppercase tracking-[0.14em] text-white shadow-sm ring-1 ring-inset ring-white/25 ${sizing}`}
    >
      {t(meta.labelKey)}
    </span>
  );
};

/* ── Tier chip — the C / R / SR / UR shorthand inside the odds panel ── */
const TierChip = ({ tier, badge }) => (
  <span
    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${badge} text-[11px] font-extrabold text-white shadow-sm ring-1 ring-inset ring-white/25`}
    aria-hidden="true"
  >
    {tier}
  </span>
);

/* ── Odds panel row — glassmorphic card + soft pink percentage badge ── */
const ProbabilityRow = ({ rarity, rate }) => {
  const { t } = useLanguage();
  const meta = resolveRarity(rarity);
  return (
    <div className="glass-panel flex items-center gap-3 rounded-2xl px-3.5 py-3">
      <TierChip tier={meta.tier} badge={meta.badge} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-800 dark:text-white">{t(meta.labelKey)}</p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-900/10 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-300"
            style={{ width: `${Math.min(Math.max(rate, 0), 100)}%` }}
          />
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center rounded-full bg-gradient-to-r from-primary-600 to-primary-400 px-3 py-1 text-xs font-extrabold tabular-nums text-white shadow-sm">
        {rate}%
      </span>
    </div>
  );
};

/* ── Drop-pool card — artwork + rarity badge + name. NO price tag. ── */
const DropPoolCard = ({ card }) => {
  const meta = resolveRarity(card?.rarity);
  return (
    <article data-testid="vbox-pool-card" className="group relative flex flex-col overflow-hidden rounded-2xl border border-purple-100/60 bg-white/90 shadow-lg shadow-purple-500/5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-pink-500/15 dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/40">
      <div data-testid="vbox-pool-art" className="relative aspect-[2.5/3.5] overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-2xl"
          style={{ background: meta.glow }}
        />
        <ProductImage
          src={card?.imageUrl}
          alt={card?.name || 'Card'}
          className="relative h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          fallbackClassName="h-full w-full"
          icon={Sparkles}
          iconClassName="h-9 w-9 text-white/90"
          label={card?.name || 'Card'}
        />
        <div className="absolute left-2.5 top-2.5 z-10">
          <RarityBadge rarity={card?.rarity} />
        </div>
      </div>
      <div className="px-2.5 pb-3 pt-2 text-center">
        <p className="truncate font-display text-[13px] font-bold tracking-tight text-ink-900 dark:text-white">
          {card?.name || 'Mystery Card'}
        </p>
        {card?.setCode && (
          <p className="mt-0.5 truncate text-[10px] font-medium tracking-wide text-ink-400 dark:text-ink-300">
            {card.setCode}
          </p>
        )}
      </div>
    </article>
  );
};

/* ── Bottom rail card — thumbnail + title + pool count + explore link ── */
const OtherBoxCard = ({ box }) => {
  const { t } = useLanguage();
  const meta = resolveRarity(box?.dropRates?.slice().sort((a, b) => (b.rate || 0) - (a.rate || 0))[0]?.rarity);
  return (
    <Link
      to={`/virtual-boxes/${box.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-purple-100/60 bg-white/90 shadow-lg shadow-purple-500/5 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-pink-500/15 dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/40"
    >
      <div className="relative p-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[75%] w-[75%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-2xl"
          style={{ background: meta.glow }}
        />
        <div
          data-testid="vbox-other-art"
          className="relative w-full h-48 sm:h-56 flex items-center justify-center p-3 rounded-2xl bg-neutral-100/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800"
        >
          <ProductImage
            src={box.imageUrl}
            alt={box.name}
            className="max-w-full max-h-full object-contain drop-shadow-md transition-transform duration-500 group-hover:scale-105"
            fallbackClassName="h-full w-full rounded-xl"
            icon={Package}
            iconClassName="h-10 w-10 text-white/90"
            label=" "
          />
        </div>
        <span className="absolute right-5 top-5 z-10 inline-flex items-center gap-1.5 rounded-full border border-purple-100/80 bg-white/85 px-2.5 py-1 text-[10px] font-bold text-ink-600 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-neutral-900/85 dark:text-ink-200">
          <Layers className="h-3 w-3" />
          <span className="tabular-nums">{box.cardPoolCount ?? 0}</span>
          <span className="font-medium opacity-80">{t('virtualBox.cards')}</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <h3 className="line-clamp-1 font-display text-[15px] font-extrabold tracking-tight text-ink-900 dark:text-white">
          {box.name}
        </h3>
        <div className="mt-3 flex items-center justify-between border-t border-ink-900/5 pt-3 dark:border-white/10">
          <span className="text-[11px] font-medium text-ink-500 dark:text-ink-300">
            {t('virtualBox.cardsInPool', { count: box.cardPoolCount ?? 0 })}
          </span>
          <span className="inline-flex items-center gap-1 text-[12px] font-bold text-primary-600 transition-transform group-hover:translate-x-0.5 dark:text-primary-300">
            {t('virtualBox.exploreNow')}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
};

const VirtualBoxDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { t } = useLanguage();

  const [box, setBox] = useState(null);
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [detailRes, listRes] = await Promise.all([
        api.get(`/virtual-boxes/${id}`),
        api.get('/virtual-boxes', { params: { page: 1, limit: 7 } })
      ]);
      setBox(detailRes.data.data);
      const items = listRes.data?.data?.items || [];
      setOthers(items.filter((b) => b.id !== id && b.slug !== id).slice(0, 3));
    } catch (err) {
      console.error(err);
      setError(t('virtualBox.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => { load(); }, [load]);

  const rates = useMemo(() => orderRates(box?.dropRates), [box]);
  const pool = useMemo(() => box?.cards || [], [box]);

  /* Era tag — derived from the dominant set-code prefix in the card pool so
     the label is data-driven rather than a hardcoded theme override. */
  const eraLabel = useMemo(() => {
    const codes = pool.map((c) => String(c?.setCode || '').split('-')[0]).filter(Boolean);
    if (codes.length === 0) return t('virtualBox.eraGeneric');
    const tally = codes.reduce((acc, code) => ({ ...acc, [code]: (acc[code] || 0) + 1 }), {});
    const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
    return `${t('virtualBox.eraLabel')} · ${top}`;
  }, [pool, t]);

  const handleOpen = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } });
      return;
    }
    setOpening(true);
  };

  if (loading) {
    return (
      <div className="relative mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8" aria-busy="true">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.15fr_1fr]">
          <div className="h-80 animate-pulse rounded-3xl bg-white/70 dark:bg-neutral-900/70" />
          <div className="h-80 animate-pulse rounded-3xl bg-white/70 dark:bg-neutral-900/70" />
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-white/70 dark:bg-neutral-900/70" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !box) {
    return (
      <div className="relative mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/80 ring-1 ring-purple-100 dark:bg-neutral-900/80 dark:ring-white/10">
          <Package className="h-8 w-8 text-primary-500" />
        </span>
        <p className="mt-5 text-lg font-semibold text-ink-900 dark:text-white">{error || t('virtualBox.loadFailed')}</p>
        <Link
          to="/virtual-boxes"
          className="mt-6 inline-flex items-center gap-2 rounded-full border border-purple-100 bg-white/90 px-5 py-2.5 text-sm font-semibold text-ink-700 shadow-sm transition-colors hover:text-primary-600 dark:border-white/10 dark:bg-neutral-900/80 dark:text-ink-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('virtualBox.backToBoxes')}
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen" data-testid="vbox-detail">
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <Link
          to="/virtual-boxes"
          className="mb-7 inline-flex items-center gap-2 text-sm font-semibold text-ink-500 transition-colors hover:text-primary-600 dark:text-ink-300 dark:hover:text-primary-300"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('virtualBox.backToBoxes')}
        </Link>

        {/* ═══════════ TOP — Box highlight & transparent odds ═══════════ */}
        <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Left — box overview */}
          <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-purple-100/60 bg-white/90 p-6 shadow-xl shadow-purple-500/5 backdrop-blur-sm dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/40 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span
                data-testid="vbox-era-tag"
                className="inline-flex items-center gap-1.5 rounded-full bg-pink-100 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-pink-700 dark:bg-pink-500/20 dark:text-pink-200"
              >
                <Tag className="h-3 w-3" />
                {eraLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-500 dark:bg-white/10 dark:text-ink-300">
                <Layers className="h-3 w-3" />
                {t('virtualBox.cardsInPool', { count: box.cardPoolCount ?? pool.length })}
              </span>
            </div>

            <h1 className="mt-4 font-display text-3xl font-extrabold leading-none tracking-tightest text-ink-950 dark:text-white sm:text-[2.4rem]">
              {box.name}
            </h1>
            {box.description && (
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-500 dark:text-ink-300">
                {box.description}
              </p>
            )}

            {/* Box artwork with soft pink ambient glow — adaptive container
                accepts both portrait and landscape box assets. */}
            <div className="relative mt-7 flex flex-1 items-center justify-center">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-pink-500/40 blur-[64px] dark:bg-pink-600/40"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-400/30 blur-[52px]"
              />
              <div
                data-testid="vbox-hero-art"
                className="relative w-full h-48 sm:h-56 flex items-center justify-center p-3 rounded-2xl bg-neutral-100/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800"
              >
                <ProductImage
                  src={box.imageUrl}
                  alt={box.name}
                  className="max-w-full max-h-full object-contain drop-shadow-md"
                  fallbackClassName="h-full w-full rounded-2xl"
                  icon={Package}
                  iconClassName="h-14 w-14 text-white/90"
                  label=" "
                />
              </div>
            </div>

            {/* Single, prominent free CTA — no currency, no multi-pack bundles */}
            <div className="mt-8 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleOpen}
                data-testid="vbox-free-open"
                aria-label={t('virtualBox.freeOpenCta')}
                className="btn-aura w-full max-w-md text-base sm:w-auto sm:px-12"
              >
                <PackageOpen className="h-5 w-5" />
                {t('virtualBox.freeOpenCta')}
              </button>
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-400 dark:text-ink-400">
                <ShieldCheck className="h-3.5 w-3.5 text-primary-500" />
                {t('virtualBox.intro')}
              </p>
            </div>
          </div>

          {/* Right — transparent drop rates */}
          <div className="flex h-full flex-col rounded-3xl border border-purple-100/60 bg-white/90 p-6 shadow-xl shadow-purple-500/5 backdrop-blur-sm dark:border-white/10 dark:bg-neutral-900/80 dark:shadow-black/40 sm:p-8">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-400 text-white shadow-sm">
                <Percent className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-display text-lg font-extrabold tracking-tight text-ink-900 dark:text-white">
                  {t('virtualBox.transparencyTitle')}
                </h2>
                <p className="text-xs font-medium text-ink-400 dark:text-ink-400">{t('virtualBox.intro')}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3" data-testid="vbox-probabilities">
              {rates.length === 0 ? (
                <p className="text-sm font-medium text-ink-400 dark:text-ink-400">{t('virtualBox.dropRatesHidden')}</p>
              ) : (
                rates.map((entry) => (
                  <ProbabilityRow key={entry.rarity} rarity={entry.rarity} rate={entry.rate} />
                ))
              )}
            </div>
          </div>
        </section>

        {/* ═══════════ MIDDLE — Drop pool showcase ═══════════ */}
        <section className="mt-12 sm:mt-14" data-testid="vbox-drop-pool">
          <div className="mb-6 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-primary-400 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <h2 className="font-display text-xl font-extrabold uppercase tracking-[0.08em] text-ink-900 dark:text-white sm:text-2xl">
              {t('virtualBox.dropPoolTitle')}
            </h2>
          </div>

          {pool.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-purple-200/70 bg-white/70 px-5 py-10 text-center text-sm font-medium text-ink-400 dark:border-white/10 dark:bg-neutral-900/60 dark:text-ink-400">
              {t('virtualBox.poolEmpty')}
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6" data-testid="vbox-pool-grid">
              {pool.map((card) => (
                <DropPoolCard key={card.id} card={card} />
              ))}
            </div>
          )}
        </section>

        {/* ═══════════ BOTTOM — Other featured boxes ═══════════ */}
        {others.length > 0 && (
          <section className="mt-14 sm:mt-16" data-testid="vbox-other-boxes">
            <h2 className="mb-6 font-display text-xl font-extrabold tracking-tight text-ink-900 dark:text-white sm:text-2xl">
              {t('virtualBox.otherBoxesTitle')}
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((other) => (
                <OtherBoxCard key={other.id} box={other} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Free unboxing ceremony — shared immersive modal. No items are stored
          in a temporary vault; the pull is shown and dismissed in-place. */}
      <GachaOpeningModal
        open={opening}
        boxId={box?.id || null}
        boxName={box?.name || 'Mystery Box'}
        boxGradient={boxBackground(box)}
        boxImageUrl={box?.imageUrl || null}
        onClose={() => setOpening(false)}
      />
    </div>
  );
};

export default VirtualBoxDetailPage;
