import React from 'react';
import { Boxes, Layers, ArrowRight } from 'lucide-react';
import ProductImage from '../ProductImage';
import TiltCard from '../TiltCard';
import { useLanguage } from '../../i18n/LanguageContext';

/* ── Rarity spectrum — neutral silver → pastel pink → deep magenta.
   Strictly cool/brand-safe: no amber/gold/orange tones. ── */
const RARITY_ORDER = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

const RARITY_META = {
  COMMON: {
    labelKey: 'gacha.rarity.COMMON',
    bar: 'linear-gradient(90deg, #cbd5e1, #94a3b8)',
    dot: '#94a3b8'
  },
  RARE: {
    labelKey: 'gacha.rarity.RARE',
    bar: 'linear-gradient(90deg, #f9a8d4, #ec4899)',
    dot: '#ec4899'
  },
  EPIC: {
    labelKey: 'gacha.rarity.EPIC',
    bar: 'linear-gradient(90deg, #ec4899, #d946ef)',
    dot: '#d946ef'
  },
  LEGENDARY: {
    labelKey: 'gacha.rarity.LEGENDARY',
    bar: 'linear-gradient(90deg, #db2777, #d946ef)',
    dot: '#db2777'
  }
};

const normalizeRates = (dropRates = []) =>
  RARITY_ORDER
    .map((rarity) => {
      const entry = (dropRates || []).find(
        (d) => String(d?.rarity).toUpperCase() === rarity
      );
      return entry ? { rarity, rate: Number(entry.rate) || 0 } : null;
    })
    .filter(Boolean)
    .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

/* ── Sleek 4-segment gradient drop-rate bar — one multi-color
    strip (neutral silver → pink → fuchsia → deep magenta); each rarity
    segment is focusable and lifts a clean light-glass tooltip with its
    exact percentage on hover/focus. No text-heavy legend. ── */
const DropRateBar = ({ dropRates }) => {
  const { t } = useLanguage();
  const rates = normalizeRates(dropRates);
  if (rates.length === 0) {
    return <p className="text-[11px] font-medium text-ink-400 dark:text-ink-400">{t('virtualBox.dropRatesHidden')}</p>;
  }
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-ink-900/[0.06] dark:bg-white/10 ring-1 ring-ink-900/5 dark:ring-white/10"
      role="img"
      aria-label={rates.map((r) => `${t(RARITY_META[r.rarity].labelKey)} ${r.rate}%`).join(', ')}
    >
      {rates.map((r) => (
        <div
          key={r.rarity}
          className="vb-seg"
          tabIndex={0}
          style={{ width: `${Math.max(r.rate, 0)}%`, backgroundImage: RARITY_META[r.rarity].bar }}
          aria-label={`${RARITY_META[r.rarity].label} ${r.rate}%`}
        >
          <span className="vb-seg-tip" aria-hidden="true">
            <span className="vb-seg-tip-dot" style={{ background: RARITY_META[r.rarity].dot }} />
            {t(RARITY_META[r.rarity].labelKey)} · <span className="tabular-nums">{r.rate}%</span>
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── Pool-count badge — small light glass chip riding the pack stage ── */
const PackCountBadge = ({ count }) => {
  const { t } = useLanguage();
  return (
    <span className="absolute right-3.5 top-3.5 z-10 inline-flex items-center gap-1.5 rounded-full border border-purple-100/80 dark:border-white/10 bg-white/85 md:bg-white/75 dark:bg-[#1c1216]/85 md:dark:bg-[#1c1216]/75 px-2.5 py-1 text-[10px] font-bold tracking-wide text-ink-600 dark:text-ink-200 shadow-sm backdrop-blur-sm">
      <Layers className="h-3 w-3" />
      <span className="tabular-nums">{count ?? 0}</span>
      <span className="font-medium opacity-80">{t('virtualBox.cards')}</span>
    </span>
  );
};

/* ── Pack hero — the booster art stands alone at the center of the
     glass card with a floating violet drop-shadow (.vb-pack). No
     inner box frames behind the artwork. TiltCard adds the smooth
     pointer-tracked 3D perspective tilt while hovering. ── */
const PackHero = ({ box }) => (
  <div className="relative flex aspect-[4/5] items-center justify-center">
    <PackCountBadge count={box.cardPoolCount} />
    <TiltCard
      className="relative flex h-full w-full items-center justify-center"
      perspective={1000}
      max={8}
      scale={1.03}
      glare
      foil={false}
      spotlight={false}
      glitch={false}
      edge={false}
    >
      <div className="vb-pack flex h-[86%] w-[86%] items-center justify-center">
        <ProductImage
          src={box.imageUrl}
          alt={box.name}
          className="max-h-full w-auto max-w-full object-contain"
          fallbackClassName="h-full w-full rounded-2xl"
          icon={Boxes}
          iconClassName="h-12 w-12 text-white/90"
          label=" "
        />
      </div>
    </TiltCard>
  </div>
);

/* ── Explore CTA — full-width pink pill, springy press. Opens the free
     detail/opening page for the box (no currency, no purchase bundle). ── */
const OpenBoxCta = ({ box, onPlay }) => {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={() => onPlay(box)}
      data-testid="vbox-card-open"
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg shadow-pink-500/25 ring-1 ring-inset ring-white/20 touch-manipulation transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-pink-500/30 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98]"
      aria-label={t('virtualBox.exploreNow')}
    >
      {t('virtualBox.exploreNow')}
      <ArrowRight className="h-4 w-4" />
    </button>
  );
};

/* ── Storefront card — ONE unified light glass surface
      (bg-white/80 + backdrop-blur-md + purple-100/60 hairline +
      soft purple shadow). Pack hero floats on top, high-contrast
      name + description below, segmented drop-rate bar and CTA
      pinned to the card foot. Hover lifts the whole card while
      the 3D tilt + pack float animate inside. Mobile (≤768px)
      drops to bg-white/90 + backdrop-blur-sm via the responsive
      classes below to keep the GPU off the scroll critical path.
      translate-z-0 + will-change-transform are defined as GPU
      layer-promotion utilities in index.css (the translate
      property composes with, never replaces, the hover lifts). ── */
const VirtualBoxCard = ({ box, index = 0, onPlay }) => {
  const { t } = useLanguage();
  return (
  <div className="h-full animate-tcg-reveal will-change-transform translate-z-0" style={{ animationDelay: `${Math.min(index * 0.06, 0.42)}s` }}>
    <article data-testid="vbox-card" className="group vb-lift will-change-transform translate-z-0 flex h-full flex-col overflow-hidden rounded-2xl border border-purple-100/60 dark:border-white/10 bg-white/90 md:bg-white/80 dark:bg-[#1c1216]/90 md:dark:bg-[#1c1216]/80 shadow-xl shadow-purple-500/5 dark:shadow-black/40 dark:shadow-2xl backdrop-blur-sm md:backdrop-blur-md transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/10 dark:hover:shadow-black/60">
      <PackHero box={box} />

      {/* Copy block — high-contrast ink text directly on the light glass card */}
      <div className="flex flex-1 flex-col px-5 pb-5 pt-4 text-center">
        <h3 className="font-display text-[17px] font-extrabold leading-tight tracking-tight text-ink-950 dark:text-white [text-wrap:balance]">
          {box.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-500 dark:text-ink-300">
          {box.description || t('virtualBox.sealedDefaultDesc')}
        </p>

        {/* Sleek drop-rate bar + CTA pinned to the card foot */}
        <div className="mt-auto pt-4">
          <DropRateBar dropRates={box.dropRates} />
          <div className="mt-4">
            <OpenBoxCta box={box} onPlay={onPlay} />
          </div>
        </div>
      </div>
    </article>
  </div>
  );
};

export default VirtualBoxCard;
