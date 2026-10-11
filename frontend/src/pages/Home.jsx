import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Shield,
  Truck,
  CreditCard,
  BadgeCheck,
  Sparkles,
  Layers,
  Box,
  Flame,
  Zap,
  Brain,
  Swords,
  Circle,
  Snowflake,
  Skull,
  PackageOpen,
  ShoppingCart,
  Eye
} from 'lucide-react';
import api from '../services/api';
import ProductImage from '../components/ProductImage';
import TiltCard from '../components/TiltCard';
import { derivePriceAndStock, detectSealed } from '../components/ProductCard';
import { useCartStore } from '../store/useCartStore';
import { formatVND } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';

const SOFT_ORB_MASK = 'radial-gradient(circle, rgba(0,0,0,1) 28%, rgba(0,0,0,0.5) 56%, transparent 78%)';

export const DEFAULT_HERO_CONTENT = {
  badge: 'Don\u2019t Miss Out',
  headline: 'Discover Rare Pokémon Cards You Don\u2019t Want To Miss',
  subtext: 'Premium authenticated singles and sealed booster boxes, curated weekly for collectors who chase the extraordinary.'
};

/* Energy elements bar — strictly pink / rose / fuchsia accents (no orange,
   gold or amber). Order matches the storefront taxonomy:
   Đấu sĩ · Lửa · Sét · Thường · Băng · Siêu · Độc */
const POWER_TYPE_KEYS = [
  { id: 'fighter', key: 'home.powerTypeFighter', Icon: Swords, iconCls: 'from-pink-400 to-rose-500 text-white' },
  { id: 'fire', key: 'home.powerTypeFire', Icon: Flame, iconCls: 'from-rose-400 to-pink-600 text-white' },
  { id: 'electric', key: 'home.powerTypeElectric', Icon: Zap, iconCls: 'from-fuchsia-400 to-pink-500 text-white' },
  { id: 'normal', key: 'home.powerTypeNormal', Icon: Circle, iconCls: 'from-pink-200 to-pink-400 text-white' },
  { id: 'ice', key: 'home.powerTypeIce', Icon: Snowflake, iconCls: 'from-pink-300 to-fuchsia-400 text-white' },
  { id: 'psychic', key: 'home.powerTypePsychic', Icon: Brain, iconCls: 'from-fuchsia-500 to-rose-600 text-white' },
  { id: 'poison', key: 'home.powerTypePoison', Icon: Skull, iconCls: 'from-rose-500 to-fuchsia-600 text-white' }
];

/*
 * Official high-resolution Pokémon TCG card artwork, served directly from the
 * Pokémon TCG image CDN (images.pokemontcg.io). No manual setup or uploads —
 * these are stable public card-scan endpoints.
 */
const FAN_CARDS = [
  {
    key: 'blastoise',
    name: 'Blastoise',
    alt: 'Blastoise — Base Set Rare Holo',
    src: 'https://images.pokemontcg.io/base1/2_hires.png',
    rarity: 'holo rare'
  },
  {
    key: 'gengar',
    name: 'Gengar ex',
    alt: 'Gengar ex — Expedition Set',
    src: 'https://images.pokemontcg.io/ex6/108_hires.png',
    rarity: 'holo rare'
  },
  {
    key: 'charizard',
    name: 'Charizard',
    alt: 'Charizard — Base Set Rare Holo',
    src: 'https://images.pokemontcg.io/base1/4_hires.png',
    rarity: 'secret rare'
  },
  {
    key: 'pikachu',
    name: 'Pikachu ex',
    alt: 'Pikachu ex — Paldea Evolved',
    src: 'https://images.pokemontcg.io/sv2/63_hires.png',
    rarity: 'illustration rare'
  },
  {
    key: 'mew',
    name: 'Mew ex',
    alt: 'Mew ex — Legend Maker',
    src: 'https://images.pokemontcg.io/ex12/88_hires.png',
    rarity: 'hyper rare'
  }
];

const FAN_SLOTS = [
  {
    key: 'far-left',
    z: 'z-10 hover:z-30',
    cls: 'rotate-[-26deg] scale-[0.85] sm:scale-[0.87] md:scale-[0.89] lg:scale-[0.9] xl:scale-[0.92] translate-x-[-96px] sm:translate-x-[-150px] md:translate-x-[-220px] lg:translate-x-[-300px] xl:translate-x-[-360px]',
    w: 'w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(236,72,153,0.28)] dark:shadow-[0_26px_64px_-22px_rgba(244,114,182,0.5)]'
  },
  {
    key: 'mid-left',
    z: 'z-[15] hover:z-30',
    cls: 'rotate-[-13deg] scale-[0.93] sm:scale-[0.95] md:scale-[0.97] lg:scale-[0.98] xl:scale-100 translate-x-[-52px] sm:translate-x-[-84px] md:translate-x-[-124px] lg:translate-x-[-170px] xl:translate-x-[-205px]',
    w: 'w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(236,72,153,0.28)] dark:shadow-[0_26px_64px_-22px_rgba(244,114,182,0.5)]'
  },
  {
    key: 'center',
    z: 'z-20 hover:z-30',
    cls: 'scale-[0.98] sm:scale-100 lg:scale-105',
    w: 'w-44 sm:w-52 md:w-60 lg:w-72 xl:w-80',
    shadow: 'shadow-[0_32px_72px_-22px_rgba(236,72,153,0.35)] dark:shadow-[0_44px_100px_-26px_rgba(244,114,182,0.55)]',
    center: true
  },
  {
    key: 'mid-right',
    z: 'z-[15] hover:z-30',
    cls: 'rotate-[13deg] scale-[0.93] sm:scale-[0.95] md:scale-[0.97] lg:scale-[0.98] xl:scale-100 translate-x-[52px] sm:translate-x-[84px] md:translate-x-[124px] lg:translate-x-[170px] xl:translate-x-[205px]',
    w: 'w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(236,72,153,0.28)] dark:shadow-[0_26px_64px_-22px_rgba(244,114,182,0.5)]'
  },
  {
    key: 'far-right',
    z: 'z-10 hover:z-30',
    cls: 'rotate-[26deg] scale-[0.85] sm:scale-[0.87] md:scale-[0.89] lg:scale-[0.9] xl:scale-[0.92] translate-x-[96px] sm:translate-x-[150px] md:translate-x-[220px] lg:translate-x-[300px] xl:translate-x-[360px]',
    w: 'w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(236,72,153,0.28)] dark:shadow-[0_26px_64px_-22px_rgba(244,114,182,0.5)]'
  }
];

const FanCard = ({ card, slot, delay = 0 }) => (
  <div className={`absolute left-1/2 top-1/2 ${slot.z}`} style={{ transform: 'translate(-50%, -50%)' }}>
    <div className="animate-tcg-reveal" style={{ animationDelay: `${delay}s` }}>
      <div className={`will-change-transform translate-z-0 ${slot.cls}`}>
        <TiltCard
          max={slot.center ? 15 : 12}
          scale={slot.center ? 1.06 : 1.04}
          foil={Boolean(slot.center)}
          spotlight
          glare
          glitch={Boolean(slot.center)}
          edge={Boolean(slot.center)}
          rarity={card.rarity}
          className={`aspect-[5/7] rounded-[1.15rem] bg-white p-2 ring-1 ring-pink-100/70 dark:bg-white/90 dark:ring-white/10 ${slot.w} ${slot.shadow}`}
        >
          {/* Art layer lifted at its own depth for parallax drift */}
          <div
            className="relative h-full w-full overflow-hidden rounded-[0.8rem] vip-depth-mid"
            style={{ transform: 'translateZ(16px)' }}
          >
            <ProductImage
              src={card.src}
              alt={card.alt}
              label={card.name}
              loading="eager"
              decoding="async"
              className="h-full w-full object-cover"
              fallbackClassName="h-full w-full"
              iconClassName="h-8 w-8 text-white/90"
            />
          </div>
        </TiltCard>
      </div>
    </div>
  </div>
);

/* Storefront showcase card — accurate price, soft pink condition/rarity tag
   and quick-add + view actions. Business data is derived with the same
   helpers the catalog ProductCard uses, so figures never drift. */
const ShowcaseProductCard = ({ product, index = 0 }) => {
  const { t } = useLanguage();
  const addItem = useCartStore((s) => s.addItem);
  if (!product) return null;

  const { price, stock } = derivePriceAndStock(product);
  const isSealed = detectSealed(product);
  const inStock = Number(stock) > 0;
  const rawRarity = typeof product.rarity === 'string' ? product.rarity : product.rarity?.name;
  const rarityLabel =
    (rawRarity && String(rawRarity)) ||
    (isSealed ? t('home.showcaseTagSealed') : t('home.showcaseTagSingle'));

  const handleQuickAdd = (e) => {
    e.preventDefault();
    addItem(
      { id: product.id, name: product.name, price, images: product.images, stockQuantity: stock },
      1,
      null
    );
  };

  return (
    <article
      data-testid="showcase-product-card"
      className="group flex h-full animate-tcg-reveal flex-col overflow-hidden rounded-3xl border border-pink-100/60 bg-white/90 shadow-soft backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg dark:border-neutral-800 dark:bg-neutral-900/60"
      style={{ animationDelay: `${Math.min(index * 0.05, 0.4)}s` }}
    >
      <Link to={`/product/${product.id}`} className="relative block aspect-[3/4] overflow-hidden bg-gradient-to-br from-blush-50 to-pink-100/40 p-3.5 dark:from-white/5 dark:to-pink-500/5">
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-pink-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-pink-600 ring-1 ring-pink-500/20 dark:bg-pink-500/15 dark:text-pink-300">
          {rarityLabel}
        </span>
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl">
          <ProductImage
            src={product.images?.[0] || product.image || product.front_image}
            alt={product.name}
            className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
            sealed={isSealed}
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4 pt-3">
        <Link
          to={`/product/${product.id}`}
          className="font-display text-sm font-semibold leading-snug text-ink-900 line-clamp-2 transition-colors group-hover:text-pink-600 dark:text-white dark:group-hover:text-pink-300"
        >
          {product.name}
        </Link>

        <span className="mt-2 text-base font-semibold text-pink-500 dark:text-pink-400">
          {formatVND(price)}
        </span>

        <div className="mt-auto flex items-center gap-2 pt-3">
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={!inStock}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-3 py-2 text-[12px] font-semibold text-white shadow-soft ring-1 ring-inset ring-white/20 transition-all duration-300 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />
            {t('home.showcaseAdd')}
          </button>
          <Link
            to={`/product/${product.id}`}
            aria-label={`${t('home.showcaseView')} ${product.name}`}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-pink-200 px-3 py-2 text-[12px] font-semibold text-pink-600 transition-all duration-300 hover:bg-pink-50 dark:border-neutral-700 dark:text-pink-300 dark:hover:bg-white/5"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {t('home.showcaseView')}
          </Link>
        </div>
      </div>
    </article>
  );
};

/* Binary storefront taxonomy — the only two categories we surface */
const SHOP_CATEGORY_CONFIG = [
  { key: 'BOX', slug: 'sealed-products', nameKey: 'home.categoryBoxName', taglineKey: 'home.categoryBoxTagline', Icon: Box },
  { key: 'CARD', slug: 'single-cards', nameKey: 'home.categoryCardName', taglineKey: 'home.categoryCardTagline', Icon: Layers }
];

const Home = ({ hero: heroProp }) => {
  const { t } = useLanguage();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [heroContent, setHeroContent] = useState(() => ({ ...DEFAULT_HERO_CONTENT, ...(heroProp || {}) }));
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchFeatured = async () => {
      try {
        setLoading(true);
        const response = await api.get('/products?page=1&limit=8&sortBy=createdAt&order=desc');
        if (active) setFeaturedProducts(response.data.data.items || []);
        setError('');
      } catch (err) {
        console.error(err);
        setError(t('home.errFeatured'));
      } finally {
        if (active) setLoading(false);
      }
    };
    const fetchCategories = async () => {
      try {
        const response = await api.get('/categories?activeOnly=true');
        if (active) setCategories(response.data.data || []);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    fetchFeatured();
    fetchCategories();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (heroProp) setHeroContent((prev) => ({ ...prev, ...heroProp }));
  }, [heroProp]);

  const categoryCount = (slug) =>
    categories.find((c) => String(c.slug || '').toLowerCase() === slug)?._count?.products ?? null;

  const features = [
    { icon: Shield, title: t('home.featureAuthenticTitle'), desc: t('home.featureAuthenticDesc') },
    { icon: Truck, title: t('home.featureShippingTitle'), desc: t('home.featureShippingDesc') },
    { icon: CreditCard, title: t('home.featurePaymentTitle'), desc: t('home.featurePaymentDesc') },
    { icon: BadgeCheck, title: t('home.featureGradingTitle'), desc: t('home.featureGradingDesc') }
  ];

  const virtualBoxBullets = [
    { icon: PackageOpen, title: t('home.virtualBoxBulletReal'), desc: t('home.virtualBoxBulletRealDesc') },
    { icon: Sparkles, title: t('home.virtualBoxBulletOdds'), desc: t('home.virtualBoxBulletOddsDesc') },
    { icon: BadgeCheck, title: t('home.virtualBoxBulletFree'), desc: t('home.virtualBoxBulletFreeDesc') }
  ];

  /* Adaptive featured grid: the standard responsive 4-column grid fills up as
     the catalog grows, while 1–3 products are centered instead of being stuck
     to the far-left edge. */
  const featuredCount = featuredProducts.length;
  const featuredGridClass =
    featuredCount >= 4
      ? 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4'
      : featuredCount === 3
        ? 'mx-auto grid w-full max-w-5xl grid-cols-1 justify-center gap-6 sm:grid-cols-2 lg:grid-cols-3'
        : featuredCount === 2
          ? 'mx-auto grid w-full max-w-3xl grid-cols-1 justify-center gap-6 sm:grid-cols-2'
          : 'mx-auto grid w-full max-w-sm grid-cols-1 justify-center gap-6';

  return (
    <div className="min-h-screen bg-transparent">
      {/* ===================== 1. PASTEL EDITORIAL HERO + CARD FAN ===================== */}
      {/* Every section is transparent; the layout root owns the ONE global
          gradient (App.jsx) so no local band cuts the canvas. */}
      <section data-testid="home-hero" className="relative overflow-x-clip bg-transparent">
        <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-80">
          <div aria-hidden="true" className="absolute -left-24 -top-16 h-[24rem] w-[24rem]">
            <div
              className="h-full w-full animate-tcg-drift rounded-full bg-blush-300/50 blur-[110px] dark:bg-primary-500/20"
              style={{ maskImage: SOFT_ORB_MASK, WebkitMaskImage: SOFT_ORB_MASK }}
            />
          </div>
          <div aria-hidden="true" className="absolute -right-20 top-1/4 h-[22rem] w-[22rem]">
            <div
              className="h-full w-full animate-tcg-drift rounded-full bg-primary-300/40 blur-[110px] dark:bg-primary-400/15"
              style={{ animationDelay: '2.4s', maskImage: SOFT_ORB_MASK, WebkitMaskImage: SOFT_ORB_MASK }}
            />
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
          {/* Top pill tag */}
          {heroContent.badge && (
            <div className="flex justify-center">
              <span className="animate-tcg-reveal">
                <span className="animate-tcg-bob motion-reduce:animate-none pill-badge">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-pink-500" />
                  </span>
                  {t('home.heroBadge')}
                </span>
              </span>
            </div>
          )}

          {/* Headline + subheadline — editorial serif pink accent on the
              focus phrase. */}
          <h1 className="mx-auto mt-7 max-w-3xl text-center font-display text-4xl font-extrabold leading-[1.2] tracking-tight text-ink-950 dark:text-white [text-wrap:balance] animate-tcg-reveal sm:text-5xl sm:leading-[1.2] lg:text-6xl lg:leading-[1.2]" style={{ animationDelay: '0.08s' }}>
            {t('home.heroHeadlinePre')}{' '}
            <span className="editorial-serif text-gradient-brand">
              {t('home.heroHeadlineHighlight')}
            </span>{' '}
            {t('home.heroHeadlinePost')}
          </h1>
          {heroContent.subtext && (
            <p className="mx-auto mt-5 max-w-xl text-center text-base leading-[1.65] text-ink-600 dark:text-ink-300 animate-tcg-reveal sm:text-lg" style={{ animationDelay: '0.16s' }}>
              {t('home.heroSubtext')}
            </p>
          )}

          {/* Interactive 3D card fan — layered rotation with rose backglow */}
          <div className="relative mx-auto mt-14 h-72 w-full max-w-6xl overflow-x-clip sm:mt-16 sm:h-[340px] md:h-[400px] lg:h-[460px]" role="group" aria-label="Featured card fan showcase">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blush-300/50 via-primary-200/40 to-blush-200/50 blur-3xl dark:from-primary-500/20 dark:via-primary-400/20 dark:to-primary-600/20"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[4%] top-1/2 h-44 w-44 -translate-y-1/2 animate-aura-pulse rounded-full bg-pink-300/30 blur-3xl dark:bg-pink-500/20 sm:h-52 sm:w-52 lg:left-[2%] lg:h-64 lg:w-64"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-[4%] top-1/2 h-44 w-44 -translate-y-1/2 animate-aura-pulse rounded-full bg-rose-400/30 blur-3xl dark:bg-pink-400/20 sm:h-52 sm:w-52 lg:right-[2%] lg:h-64 lg:w-64"
              style={{ animationDelay: '1.4s' }}
            />
            <div aria-hidden="true" className="pointer-events-none absolute bottom-2 left-1/2 h-12 w-[72%] -translate-x-1/2 rounded-[100%] bg-pink-400/25 blur-2xl dark:bg-pink-500/25" />
            {FAN_SLOTS.map((slot, i) => (
              <FanCard key={slot.key} slot={slot} card={FAN_CARDS[i]} delay={0.2 + i * 0.09} />
            ))}
          </div>

          {/* Brand mission callout — open-canvas editorial typography */}
          <div
            data-testid="home-mission-card"
            className="relative animate-tcg-reveal text-center my-12 sm:my-16 max-w-4xl mx-auto px-4"
            style={{ animationDelay: '0.28s' }}
          >
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] font-bold leading-[1.35] tracking-tight text-ink-950 dark:text-white">
              <span className="editorial-serif italic font-normal text-pink-500 dark:text-pink-400 px-1">{t('home.scriptWeAre')}</span>{' '}
              {t('home.scriptHereTo')}{' '}
              <Sparkles className="mx-1 inline-block h-[0.8em] w-[0.8em] -translate-y-[0.1em] text-pink-400" aria-hidden="true" />{' '}
              <span className="editorial-serif italic font-normal text-pink-500 dark:text-pink-400 px-1">{t('home.scriptTurn')}</span>{' '}
              {t('home.scriptPassion')}{' '}
              <span className="editorial-serif italic font-normal text-pink-500 dark:text-pink-400 px-1">{t('home.scriptReal')}</span>
              <Sparkles className="mx-1 inline-block h-[0.8em] w-[0.8em] -translate-y-[0.1em] text-pink-400" aria-hidden="true" />
            </h2>
            <p className="mx-auto mt-6 max-w-2xl text-center text-base sm:text-lg text-ink-500 dark:text-ink-300 leading-relaxed font-normal">
              {t('home.heroFooterNote')}
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                to="/catalog"
                className="group inline-flex items-center gap-2.5 rounded-full bg-pink-500 hover:bg-pink-600 px-8 py-3.5 text-base font-bold text-white shadow-[0_10px_25px_-5px_rgba(236,72,153,0.35)] ring-1 ring-inset ring-white/30 transition-all duration-300 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
              >
                {t('home.shopNow')} <ArrowRight className="h-4 w-4 -translate-y-px transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Energy elements bar — pink hover highlights */}
          <div className="mt-14 pb-20 sm:mt-16 sm:pb-24">
            <h2 className="sr-only">{t('home.powerTypes')}</h2>
            <div
              data-testid="energy-elements-bar"
              className="animate-tcg-reveal mx-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-pink-100/70 bg-white/70 px-4 py-3 shadow-soft backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:justify-center sm:px-6"
              role="list"
              aria-label={t('home.powerTypes')}
              style={{ animationDelay: '0.42s' }}
            >
              {POWER_TYPE_KEYS.map(({ id, key, Icon, iconCls }) => (
                <span
                  key={id}
                  role="listitem"
                  aria-label={t(key)}
                  className="group inline-flex shrink-0 cursor-default select-none items-center gap-2 rounded-full px-3 py-1.5 transition-[transform,background-color] duration-300 ease-out hover:-translate-y-1.5 hover:bg-pink-500/10 dark:hover:bg-pink-500/15 motion-reduce:transition-none"
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br shadow-soft transition-transform duration-300 group-hover:scale-110 ${iconCls}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-ink-700 dark:text-ink-100">{t(key)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== 2. TRUST FEATURE CARDS ===================== */}
      <section data-testid="home-trust" className="relative -mt-6 z-10 bg-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                data-testid="trust-feature-card"
                className="animate-tcg-reveal flex items-start gap-4 rounded-2xl border border-pink-100/10 bg-white/5 p-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-pink-300/40 dark:border-neutral-800 dark:bg-neutral-900/60"
                style={{ animationDelay: `${0.1 + i * 0.06}s` }}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/15 to-rose-500/15 ring-1 ring-pink-500/20">
                  <f.icon className="h-6 w-6 text-pink-600 dark:text-pink-400" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="font-semibold text-ink-900 dark:text-white">{f.title}</h3>
                  <p className="text-sm text-ink-500 dark:text-ink-300">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== 3. SHOP BY CATEGORY (editorial bridge) ===================== */}
      <section data-testid="home-categories" className="pt-20 bg-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 bg-transparent">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="section-eyebrow">{t('home.collectionsEyebrow')}</p>
              <h2 className="mt-2 heading-display text-3xl dark:text-white">{t('home.shopByCategory')}</h2>
            </div>
            <Link to="/catalog" className="flex shrink-0 items-center font-medium text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-white">
              {t('home.viewAll')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="mx-auto grid max-w-3xl grid-cols-2 gap-4 sm:gap-6">
            {SHOP_CATEGORY_CONFIG.map(({ key, slug, nameKey, taglineKey, Icon }, i) => {
              const count = categoryCount(slug);
              return (
                <Link
                  key={key}
                  to={`/catalog?category=${slug}`}
                  className="group relative h-36 sm:h-44 flex flex-col items-center justify-center text-center p-6 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-none md:backdrop-blur-md border border-pink-100/70 dark:border-neutral-800 rounded-3xl shadow-sm text-neutral-900 dark:text-neutral-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 animate-tcg-reveal overflow-hidden"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-pink-500/0 to-rose-500/0 transition-colors duration-500 group-hover:from-pink-500/10 group-hover:to-rose-500/15" />
                  <div aria-hidden="true" className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-pink-400/0 blur-2xl transition-colors duration-500 group-hover:bg-pink-400/20" />
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-100/60 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-7 w-7 text-pink-700 dark:text-pink-300" aria-hidden="true" />
                  </span>
                  <span className="relative mt-3 font-display text-lg font-bold text-neutral-900 transition-colors group-hover:text-pink-700 dark:text-pink-50 dark:group-hover:text-pink-300">{t(nameKey)}</span>
                  <span className="relative mt-1 line-clamp-2 break-words text-xs text-ink-500 dark:text-ink-300">{t(taglineKey)}</span>
                  {count !== null && (
                    <span className="relative mt-1.5 text-[11px] font-semibold text-ink-400 dark:text-ink-400">{t('home.productsCount', { count })}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== 4. FEATURED PRODUCTS — 4-COLUMN SHOWCASE ===================== */}
      <section data-testid="home-featured" className="mt-10 pb-12 bg-transparent">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="heading-display text-3xl dark:text-white">{t('home.featuredTitle')}</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="surface-editorial animate-pulse p-2">
                  <div className="mb-3 h-64 rounded-2xl bg-pink-50 dark:bg-white/5" />
                  <div className="mx-auto mb-2 h-4 w-3/4 rounded bg-pink-50 dark:bg-white/5" />
                  <div className="mx-auto h-5 w-1/3 rounded bg-pink-50 dark:bg-white/5" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-500 dark:text-rose-400">{error}</div>
          ) : (
            <div data-testid="featured-grid" className={featuredGridClass}>
              {featuredProducts.map((product, idx) => (
                <ShowcaseProductCard key={product.id} product={product} index={idx} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===================== 5. FREE VIRTUAL BOX ("MỞ HỘP ÁO MIỄN PHÍ") =====================
          Business rule: the Virtual Box is a FREE / promotional experience.
          This module must never show prices, fees or currency amounts — it
          only links to the existing free open flow at /virtual-boxes. */}
      <section data-testid="home-virtual-box" className="py-12 bg-transparent">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div
            data-testid="virtual-box-card"
            className="relative overflow-hidden rounded-[2rem] border border-pink-100 bg-white/90 p-8 text-center text-neutral-900 shadow-xl shadow-pink-500/5 sm:p-12 dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-100"
          >
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-pink-500/15 blur-[90px] dark:bg-pink-500/25" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-rose-500/10 blur-[90px] dark:bg-rose-500/20" />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-4 py-1.5 text-xs font-semibold text-pink-600 dark:border-pink-500/30 dark:bg-pink-500/10 dark:text-pink-300">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {t('home.virtualBoxEyebrow')}
              </span>
              <h2 className="mt-5 font-display text-3xl font-extrabold text-neutral-900 sm:text-4xl dark:text-white">
                {t('home.virtualBoxTitle')}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-300">
                {t('home.virtualBoxSubtext')}
              </p>

              <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
                {virtualBoxBullets.map((b) => (
                  <div key={b.title} className="rounded-2xl border border-pink-100 bg-pink-50/60 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-pink-100 text-pink-600 ring-1 ring-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-500/25">
                      <b.icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="mt-3 text-sm font-semibold text-neutral-900 dark:text-white">{b.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">{b.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-9">
                <Link
                  to="/virtual-boxes"
                  data-testid="virtual-box-free-cta"
                  className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 px-8 py-3.5 text-base font-bold text-white shadow-[0_10px_40px_-10px_rgba(236,72,153,0.8)] ring-1 ring-inset ring-white/25 transition-all duration-300 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
                >
                  <PackageOpen className="h-5 w-5" aria-hidden="true" />
                  {t('home.virtualBoxCta')}
                  <Sparkles className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" aria-hidden="true" />
                </Link>
                <p className="mt-4 text-xs font-medium text-pink-600/80 dark:text-pink-200/80">{t('home.virtualBoxNote')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
