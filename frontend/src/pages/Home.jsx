import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Shield,
  Truck,
  CreditCard,
  Star,
  Sparkles,
  Layers,
  Box,
  Flame,
  Ghost,
  Zap,
  Brain,
  Swords,
  Circle,
  Snowflake
} from 'lucide-react';
import api from '../services/api';
import ProductCard from '../components/ProductCard';
import TiltCard from '../components/TiltCard';
import ProductImage from '../components/ProductImage';
import { useLanguage } from '../i18n/LanguageContext';

const SOFT_ORB_MASK = 'radial-gradient(circle, rgba(0,0,0,1) 28%, rgba(0,0,0,0.5) 56%, transparent 78%)';

export const DEFAULT_HERO_CONTENT = {
  badge: 'Don\u2019t Miss Out',
  headline: 'Discover Rare Pokémon Cards You Don\u2019t Want To Miss',
  subtext: 'Premium authenticated singles and sealed booster boxes, curated weekly for collectors who chase the extraordinary.'
};

const POWER_TYPE_KEYS = [
  { id: 'fighter', key: 'home.powerTypeFighter', Icon: Swords, iconCls: 'from-orange-300 to-primary-400 text-white' },
  { id: 'fire', key: 'home.powerTypeFire', Icon: Flame, iconCls: 'from-primary-300 to-primary-500 text-white' },
  { id: 'ghost', key: 'home.powerTypeGhost', Icon: Ghost, iconCls: 'from-blush-400 to-primary-400 text-white' },
  { id: 'normal', key: 'home.powerTypeNormal', Icon: Circle, iconCls: 'from-ink-300 to-ink-500 text-white' },
  { id: 'ice', key: 'home.powerTypeIce', Icon: Snowflake, iconCls: 'from-cyan-200 to-sky-400 text-white' },
  { id: 'psychic', key: 'home.powerTypePsychic', Icon: Brain, iconCls: 'from-blush-500 to-primary-600 text-white' },
  { id: 'electric', key: 'home.powerTypeElectric', Icon: Zap, iconCls: 'from-amber-200 to-amber-400 text-white' }
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
    shadow: 'shadow-[0_18px_44px_-18px_rgba(225,29,72,0.28)] dark:shadow-[0_26px_64px_-22px_rgba(244,114,182,0.5)]'
  },
  {
    key: 'mid-left',
    z: 'z-[15] hover:z-30',
    cls: 'rotate-[-13deg] scale-[0.93] sm:scale-[0.95] md:scale-[0.97] lg:scale-[0.98] xl:scale-100 translate-x-[-52px] sm:translate-x-[-84px] md:translate-x-[-124px] lg:translate-x-[-170px] xl:translate-x-[-205px]',
    w: 'w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(225,29,72,0.28)] dark:shadow-[0_26px_64px_-22px_rgba(244,114,182,0.5)]'
  },
  {
    key: 'center',
    z: 'z-20 hover:z-30',
    cls: 'scale-[0.98] sm:scale-100 lg:scale-105',
    w: 'w-44 sm:w-52 md:w-60 lg:w-72 xl:w-80',
    shadow: 'shadow-[0_32px_72px_-22px_rgba(225,29,72,0.35)] dark:shadow-[0_44px_100px_-26px_rgba(244,114,182,0.55)]',
    center: true
  },
  {
    key: 'mid-right',
    z: 'z-[15] hover:z-30',
    cls: 'rotate-[13deg] scale-[0.93] sm:scale-[0.95] md:scale-[0.97] lg:scale-[0.98] xl:scale-100 translate-x-[52px] sm:translate-x-[84px] md:translate-x-[124px] lg:translate-x-[170px] xl:translate-x-[205px]',
    w: 'w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(225,29,72,0.28)] dark:shadow-[0_26px_64px_-22px_rgba(244,114,182,0.5)]'
  },
  {
    key: 'far-right',
    z: 'z-10 hover:z-30',
    cls: 'rotate-[26deg] scale-[0.85] sm:scale-[0.87] md:scale-[0.89] lg:scale-[0.9] xl:scale-[0.92] translate-x-[96px] sm:translate-x-[150px] md:translate-x-[220px] lg:translate-x-[300px] xl:translate-x-[360px]',
    w: 'w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(225,29,72,0.28)] dark:shadow-[0_26px_64px_-22px_rgba(244,114,182,0.5)]'
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
          className={`aspect-[5/7] rounded-[1.15rem] bg-white p-2 ring-1 ring-primary-100/70 dark:bg-white/90 dark:ring-white/10 ${slot.w} ${slot.shadow}`}
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

/* Binary storefront taxonomy — the only two categories we surface */
const SHOP_CATEGORY_CONFIG = [
  {
    key: 'BOX',
    slug: 'sealed-products',
    nameKey: 'home.categoryBoxName',
    taglineKey: 'home.categoryBoxTagline',
    Icon: Box,
    iconCls: 'from-amber-300 to-primary-400'
  },
  {
    key: 'CARD',
    slug: 'single-cards',
    nameKey: 'home.categoryCardName',
    taglineKey: 'home.categoryCardTagline',
    Icon: Layers,
    iconCls: 'from-blush-400 to-primary-500'
  }
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
    { icon: Star, title: t('home.featureRatedTitle'), desc: t('home.featureRatedDesc') }
  ];

  return (
    <div className="min-h-screen bg-transparent">
      {/* ===================== PASTEL EDITORIAL HERO ===================== */}
      {/* Every section is transparent; the layout root owns the ONE global
          gradient (App.jsx) so no local band cuts the canvas. */}
      <section className="relative overflow-x-clip bg-transparent">
        {/* Soft drifting orbs.
            overflow-x-clip (not overflow-hidden) keeps the orbs from creating a
            horizontal scrollbar while letting their light bleed vertically past
            the in-flow header boundary to the very top edge — otherwise the
            clip at y=header-bottom renders a hard horizontal band. */}
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
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
                  </span>
                  {t('home.heroBadge')}
                </span>
              </span>
            </div>
          )}

          {/* Headline + subheadline — clean sans display, editorial serif
              accent on the focus phrase. Leading 1.2 keeps stacked
              Vietnamese diacritics from clipping across lines. */}
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

          {/* 3D card fan showcase — layered rotation layout */}
          <div className="relative mx-auto mt-14 h-72 w-full max-w-6xl overflow-x-clip sm:mt-16 sm:h-[340px] md:h-[400px] lg:h-[460px]" role="group" aria-label="Featured card fan showcase">
            {/* Pastel aura glows behind the fan */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-blush-300/50 via-primary-200/40 to-blush-200/50 blur-3xl dark:from-primary-500/20 dark:via-primary-400/20 dark:to-primary-600/20"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[4%] top-1/2 h-44 w-44 -translate-y-1/2 animate-aura-pulse rounded-full bg-primary-300/30 blur-3xl dark:bg-primary-500/20 sm:h-52 sm:w-52 lg:left-[2%] lg:h-64 lg:w-64"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-[4%] top-1/2 h-44 w-44 -translate-y-1/2 animate-aura-pulse rounded-full bg-blush-400/30 blur-3xl dark:bg-primary-400/20 sm:h-52 sm:w-52 lg:right-[2%] lg:h-64 lg:w-64"
              style={{ animationDelay: '1.4s' }}
            />
            <div aria-hidden="true" className="pointer-events-none absolute bottom-2 left-1/2 h-12 w-[72%] -translate-x-1/2 rounded-[100%] bg-primary-400/25 blur-2xl dark:bg-primary-500/25" />
            {FAN_SLOTS.map((slot, i) => (
              <FanCard key={slot.key} slot={slot} card={FAN_CARDS[i]} delay={0.2 + i * 0.09} />
            ))}
          </div>

          {/* Editorial text block — mixed typography, serif italic focus
              words. 1.4 line box keeps Vietnamese diacritics from clipping. */}
          <div className="mx-auto mt-16 max-w-3xl text-center sm:mt-20">
            <p className="font-display text-2xl font-bold leading-[1.4] tracking-tight text-ink-950 dark:text-white animate-tcg-reveal sm:text-3xl sm:leading-[1.4] lg:text-[2.4rem] lg:leading-[1.4]" style={{ animationDelay: '0.28s' }}>
              <span className="editorial-serif -rotate-2 inline-block bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text px-2 text-transparent">{t('home.scriptWeAre')}</span>{' '}
              {t('home.scriptHereTo')}{' '}
              <Flame className="mx-0.5 inline-block h-[0.8em] w-[0.8em] -translate-y-[0.06em] text-primary-500" aria-hidden="true" />{' '}
              <span className="editorial-serif -rotate-1 inline-block bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text px-2 text-transparent">{t('home.scriptTurn')}</span>{' '}
              {t('home.scriptPassion')}{' '}
              <span className="editorial-serif rotate-1 inline-block bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text px-2 text-transparent">{t('home.scriptReal')}</span>
              <Sparkles className="mx-1 inline-block h-[0.85em] w-[0.85em] -translate-y-[0.08em] text-amber-400" aria-hidden="true" />
              <span className="animate-tcg-bob motion-reduce:animate-none mx-2 mt-2 inline-block align-middle">
                <Link
                  to="/catalog"
                  className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-primary-600 to-primary-400 px-6 py-3 align-middle text-base font-bold text-white shadow-soft-lg ring-1 ring-inset ring-white/30 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98]"
                >
                  {t('home.shopNow')} <ArrowRight className="h-4 w-4 -translate-y-px transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </span>
            </p>
            <p className="mx-auto mt-5 max-w-xl text-sm text-ink-500 dark:text-ink-300 animate-tcg-reveal sm:text-base" style={{ animationDelay: '0.36s' }}>
              {t('home.heroFooterNote')}
            </p>
          </div>

          {/* Power types dock */}
          <div className="mt-14 pb-20 sm:mt-16 sm:pb-24">
            <h2 className="sr-only">{t('home.powerTypes')}</h2>
            <div
              className="animate-tcg-reveal mx-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-primary-100/70 bg-white/70 px-4 py-3 shadow-soft backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:justify-center sm:px-6"
              role="list"
              aria-label={t('home.powerTypes')}
              style={{ animationDelay: '0.42s' }}
            >
              {POWER_TYPE_KEYS.map(({ id, key, Icon, iconCls }) => (
                <span
                  key={id}
                  role="listitem"
                  aria-label={t(key)}
                  className="group inline-flex shrink-0 cursor-default select-none items-center gap-2 rounded-full px-3 py-1.5 transition-[transform,background-color] duration-300 ease-out hover:-translate-y-1.5 hover:bg-white/90 dark:hover:bg-white/10 motion-reduce:transition-none"
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

      {/* ===================== FEATURES ===================== */}
      <section className="relative -mt-6 z-10 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="flex items-center gap-4 p-5 surface-editorial animate-tcg-reveal"
                style={{ animationDelay: `${0.1 + i * 0.06}s` }}
              >
                <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-blush-100 to-primary-100 dark:from-white/10 dark:to-primary-400/20 flex items-center justify-center">
                  <f.icon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
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

      {/* ===================== CATEGORIES ===================== */}
      {/* Transparent wrapper — the global pastel canvas shows through
          uninterrupted; only the cards below carry the white surface. */}
      <section className="pt-20 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 bg-transparent">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="section-eyebrow">{t('home.collectionsEyebrow')}</p>
              <h2 className="mt-2 heading-display text-3xl dark:text-white">{t('home.shopByCategory')}</h2>
            </div>
            <Link to="/catalog" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-white font-medium flex items-center shrink-0">
              {t('home.viewAll')} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
            {SHOP_CATEGORY_CONFIG.map(({ key, slug, nameKey, taglineKey, Icon }, i) => {
              const count = categoryCount(slug);
              return (
                <Link
                  key={key}
                  to={`/catalog?category=${slug}`}
                  className="group relative overflow-hidden h-36 sm:h-44 flex flex-col items-center justify-center text-center p-6 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-pink-100/70 dark:border-neutral-800 rounded-3xl shadow-sm text-neutral-900 dark:text-neutral-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 animate-tcg-reveal"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-500/0 to-blush-500/0 group-hover:from-primary-500/10 group-hover:to-blush-500/15 transition-colors duration-500" />
                  <div aria-hidden="true" className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-primary-400/0 blur-2xl transition-colors duration-500 group-hover:bg-primary-400/20" />
                  <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-100/60 dark:bg-pink-950/50 text-pink-700 dark:text-pink-300 group-hover:scale-110 transition-transform duration-300">
                    <Icon className="h-7 w-7 text-pink-700 dark:text-pink-300" aria-hidden="true" />
                  </span>
                  <span className="relative mt-3 font-display text-lg font-bold text-neutral-900 dark:text-pink-50 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">{t(nameKey)}</span>
                  <span className="relative mt-1 text-xs text-ink-500 dark:text-ink-300 break-words line-clamp-2">{t(taglineKey)}</span>
                  {count !== null && (
                    <span className="relative mt-1.5 text-[11px] font-semibold text-ink-400 dark:text-ink-400">{t('home.productsCount', { count })}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== FEATURED / PACKS ===================== */}
      {/* Transparent — the single page-level gradient must run unbroken. */}
      <section className="mt-10 pb-20 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h2 className="heading-display text-3xl dark:text-white">{t('home.featuredTitle')}</h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="surface-editorial p-2 animate-pulse">
                  <div className="h-64 bg-primary-50 dark:bg-white/5 rounded-2xl mb-3" />
                  <div className="h-4 bg-primary-50 dark:bg-white/5 rounded w-3/4 mx-auto mb-2" />
                  <div className="h-5 bg-primary-50 dark:bg-white/5 rounded w-1/3 mx-auto" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center text-rose-500 dark:text-rose-400 py-12">{error}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===================== PROMO / CTA ===================== */}
      <section className="relative overflow-hidden bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary-500 via-primary-400 to-blush-400 text-white p-8 sm:p-14 text-center shadow-soft-lg dark:from-[#2a1520] dark:via-[#241220] dark:to-[#1a0f18] dark:ring-1 dark:ring-white/10">
            <div className="absolute -top-20 -right-10 h-72 w-72 rounded-full bg-white/20 blur-[100px] animate-tcg-float dark:bg-primary-500/25" />
            <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-blush-200/25 blur-[100px] animate-tcg-float-slow dark:bg-primary-400/20" />
            <div className="relative">
              <Sparkles className="h-10 w-10 mx-auto text-white/90" />
              <h2 className="mt-4 font-display text-3xl sm:text-4xl font-extrabold">{t('home.ctaTitle')}</h2>
              <p className="mt-3 text-white/85 max-w-xl mx-auto">{t('home.ctaBody')}</p>
              <Link to="/catalog" className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-3.5 font-semibold text-primary-700 shadow-soft-lg transition-all duration-300 hover:-translate-y-0.5 hover:brightness-105 active:scale-[0.98]">
                {t('home.ctaBtn')} <ArrowRight className="ml-1 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
