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
import HoloCard from '../components/HoloCard';
import TiltCard from '../components/TiltCard';
import ProductImage from '../components/ProductImage';

const SOFT_ORB_MASK = 'radial-gradient(circle, rgba(0,0,0,1) 28%, rgba(0,0,0,0.5) 56%, transparent 78%)';

export const DEFAULT_HERO_CONTENT = {
  badge: 'Don\u2019t Miss Out',
  headline: 'Discover Rare Pokémon Cards You Don\u2019t Want To Miss',
  subtext: 'Premium authenticated singles and sealed booster boxes, curated weekly for collectors who chase the extraordinary.'
};

const POWER_TYPES = [
  { id: 'fighter', label: 'Fighter', Icon: Swords, iconCls: 'from-orange-400 to-rose-500 text-white' },
  { id: 'fire', label: 'Fire', Icon: Flame, iconCls: 'from-red-400 to-orange-500 text-white' },
  { id: 'ghost', label: 'Ghost', Icon: Ghost, iconCls: 'from-violet-400 to-indigo-500 text-white' },
  { id: 'normal', label: 'Normal', Icon: Circle, iconCls: 'from-stone-300 to-stone-500 text-white' },
  { id: 'ice', label: 'Ice', Icon: Snowflake, iconCls: 'from-cyan-300 to-sky-500 text-white' },
  { id: 'psychic', label: 'Psychic', Icon: Brain, iconCls: 'from-fuchsia-400 to-purple-500 text-white' },
  { id: 'electric', label: 'Electric', Icon: Zap, iconCls: 'from-amber-300 to-yellow-500 text-white' }
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
    shadow: 'shadow-[0_18px_44px_-18px_rgba(124,58,237,0.38)] dark:shadow-[0_26px_64px_-22px_rgba(147,51,234,0.65)]'
  },
  {
    key: 'mid-left',
    z: 'z-[15] hover:z-30',
    cls: 'rotate-[-13deg] scale-[0.93] sm:scale-[0.95] md:scale-[0.97] lg:scale-[0.98] xl:scale-100 translate-x-[-52px] sm:translate-x-[-84px] md:translate-x-[-124px] lg:translate-x-[-170px] xl:translate-x-[-205px]',
    w: 'w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(124,58,237,0.38)] dark:shadow-[0_26px_64px_-22px_rgba(147,51,234,0.65)]'
  },
  {
    key: 'center',
    z: 'z-20 hover:z-30',
    cls: 'scale-[0.98] sm:scale-100 lg:scale-105',
    w: 'w-44 sm:w-52 md:w-60 lg:w-72 xl:w-80',
    shadow: 'shadow-[0_32px_72px_-22px_rgba(192,38,211,0.45)] dark:shadow-[0_44px_100px_-26px_rgba(217,70,239,0.7)]',
    center: true
  },
  {
    key: 'mid-right',
    z: 'z-[15] hover:z-30',
    cls: 'rotate-[13deg] scale-[0.93] sm:scale-[0.95] md:scale-[0.97] lg:scale-[0.98] xl:scale-100 translate-x-[52px] sm:translate-x-[84px] md:translate-x-[124px] lg:translate-x-[170px] xl:translate-x-[205px]',
    w: 'w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(124,58,237,0.38)] dark:shadow-[0_26px_64px_-22px_rgba(147,51,234,0.65)]'
  },
  {
    key: 'far-right',
    z: 'z-10 hover:z-30',
    cls: 'rotate-[26deg] scale-[0.85] sm:scale-[0.87] md:scale-[0.89] lg:scale-[0.9] xl:scale-[0.92] translate-x-[96px] sm:translate-x-[150px] md:translate-x-[220px] lg:translate-x-[300px] xl:translate-x-[360px]',
    w: 'w-40 sm:w-48 md:w-56 lg:w-64 xl:w-72',
    shadow: 'shadow-[0_18px_44px_-18px_rgba(124,58,237,0.38)] dark:shadow-[0_26px_64px_-22px_rgba(147,51,234,0.65)]'
  }
];

const FanCard = ({ card, slot, delay = 0 }) => (
  <div className={`absolute left-1/2 top-1/2 ${slot.z}`} style={{ transform: 'translate(-50%, -50%)' }}>
    <div className="animate-tcg-reveal" style={{ animationDelay: `${delay}s` }}>
      <div className={`will-change-transform ${slot.cls}`}>
        <TiltCard
          max={slot.center ? 15 : 12}
          scale={slot.center ? 1.06 : 1.04}
          foil={Boolean(slot.center)}
          spotlight
          glare
          glitch={Boolean(slot.center)}
          edge={Boolean(slot.center)}
          rarity={card.rarity}
          className={`aspect-[5/7] rounded-[1.15rem] bg-white p-2 ring-1 ring-black/[0.04] dark:bg-white/90 dark:ring-white/10 ${slot.w} ${slot.shadow}`}
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
const SHOP_CATEGORIES = [
  {
    key: 'BOX',
    slug: 'box',
    name: 'Box',
    tagline: 'Sealed booster boxes & special collections',
    Icon: Box,
    iconCls: 'from-amber-400 to-orange-500'
  },
  {
    key: 'CARD',
    slug: 'card',
    name: 'Card',
    tagline: 'Authenticated singles & chase cards',
    Icon: Layers,
    iconCls: 'from-fuchsia-500 to-purple-500'
  }
];

const Home = ({ hero: heroProp }) => {
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
        setError('Failed to load featured products.');
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
  }, []);

  useEffect(() => {
    if (heroProp) setHeroContent((prev) => ({ ...prev, ...heroProp }));
  }, [heroProp]);

  const categoryCount = (slug) =>
    categories.find((c) => String(c.slug || '').toLowerCase() === slug)?._count?.products ?? null;

  const features = [
    { icon: Shield, title: 'Authenticity Guaranteed', desc: 'Every card is verified' },
    { icon: Truck, title: 'Fast Shipping', desc: 'Worldwide delivery available' },
    { icon: CreditCard, title: 'Secure Payment', desc: 'SePay bank transfer' },
    { icon: Star, title: 'Top Rated', desc: 'Trusted by collectors worldwide' }
  ];

  return (
    <div className="app-bg min-h-screen dark:bg-[#0d0714]">
      {/* ===================== DREAMY HERO ===================== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-rose-50/60 via-purple-50/40 to-pink-50/80 dark:from-[#130924] dark:via-[#0f081d] dark:to-[#09040e]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(58% 46% at 50% 0%, rgba(244,114,182,0.20) 0%, rgba(168,85,247,0.12) 42%, transparent 70%)'
          }}
        />
        {/* Neon violet tint at the crown in dark mode */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 hidden dark:block"
          style={{
            background:
              'radial-gradient(58% 46% at 50% 0%, rgba(168,85,247,0.20) 0%, rgba(217,70,239,0.12) 42%, transparent 70%)'
          }}
        />
        <div className="pointer-events-none absolute inset-0 opacity-50 dark:opacity-70">
          <div aria-hidden="true" className="absolute -left-24 -top-16 h-[24rem] w-[24rem]">
            <div
              className="h-full w-full animate-tcg-drift rounded-full bg-rose-200/60 blur-[110px] dark:bg-purple-600/20"
              style={{ maskImage: SOFT_ORB_MASK, WebkitMaskImage: SOFT_ORB_MASK }}
            />
          </div>
          <div aria-hidden="true" className="absolute -right-20 top-1/4 h-[22rem] w-[22rem]">
            <div
              className="h-full w-full animate-tcg-drift rounded-full bg-violet-200/60 blur-[110px] dark:bg-fuchsia-600/15"
              style={{ animationDelay: '2.4s', maskImage: SOFT_ORB_MASK, WebkitMaskImage: SOFT_ORB_MASK }}
            />
          </div>
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-24">
          {/* Top pill tag */}
          {heroContent.badge && (
            <div className="flex justify-center">
              <span className="animate-tcg-reveal">
                <span className="animate-tcg-bob motion-reduce:animate-none inline-flex items-center gap-2 rounded-full border border-fuchsia-200/80 bg-white/80 px-4 py-1.5 text-sm font-semibold text-fuchsia-700 shadow-[0_10px_30px_-10px_rgba(217,70,239,0.45)] backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-purple-200 dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-fuchsia-500 dark:bg-pink-400" />
                  </span>
                  {heroContent.badge}
                </span>
              </span>
            </div>
          )}

          {/* Headline + subheadline */}
          <h1 className="mx-auto mt-7 max-w-3xl text-center font-display text-4xl font-extrabold leading-[1.06] tracking-tightest text-ink-950 dark:text-white [text-wrap:balance] animate-tcg-reveal sm:text-5xl lg:text-6xl" style={{ animationDelay: '0.08s' }}>
            Discover{' '}
            <span className="bg-gradient-to-r from-fuchsia-600 to-purple-600 bg-clip-text text-transparent dark:from-pink-400 dark:to-purple-400 dark:drop-shadow-[0_0_20px_rgba(244,114,182,0.4)]">
              Rare Pokémon Cards
            </span>{' '}
            You Don&rsquo;t Want To Miss
          </h1>
          {heroContent.subtext && (
            <p className="mx-auto mt-5 max-w-xl text-center text-base leading-relaxed text-ink-600 dark:text-purple-200/70 animate-tcg-reveal sm:text-lg" style={{ animationDelay: '0.16s' }}>
              {heroContent.subtext}
            </p>
          )}

          {/* 3D card fan showcase — wide cinematic spread */}
          <div className="relative mx-auto mt-14 h-72 w-full max-w-6xl overflow-x-clip sm:mt-16 sm:h-[340px] md:h-[400px] lg:h-[460px]" role="group" aria-label="Featured card fan showcase">
            {/* Neon aura glows behind the fan */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-fuchsia-300/40 via-violet-300/30 to-rose-300/40 blur-3xl dark:from-purple-600/20 dark:via-fuchsia-600/20 dark:to-purple-500/20"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[4%] top-1/2 h-44 w-44 -translate-y-1/2 animate-aura-pulse rounded-full bg-violet-300/30 blur-3xl dark:bg-purple-600/20 sm:h-52 sm:w-52 lg:left-[2%] lg:h-64 lg:w-64"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-[4%] top-1/2 h-44 w-44 -translate-y-1/2 animate-aura-pulse rounded-full bg-fuchsia-300/30 blur-3xl dark:bg-fuchsia-600/20 sm:h-52 sm:w-52 lg:right-[2%] lg:h-64 lg:w-64"
              style={{ animationDelay: '1.4s' }}
            />
            <div aria-hidden="true" className="pointer-events-none absolute bottom-2 left-1/2 h-12 w-[72%] -translate-x-1/2 rounded-[100%] bg-fuchsia-400/25 blur-2xl dark:bg-purple-600/25" />
            {FAN_SLOTS.map((slot, i) => (
              <FanCard key={slot.key} slot={slot} card={FAN_CARDS[i]} delay={0.2 + i * 0.09} />
            ))}
          </div>

          {/* Decorative editorial typography */}
          <div className="mx-auto mt-16 max-w-3xl text-center sm:mt-20">
            <p className="font-display text-2xl font-bold leading-[1.3] tracking-tight text-ink-950 dark:text-white animate-tcg-reveal sm:text-3xl lg:text-[2.6rem]" style={{ animationDelay: '0.28s' }}>
              <span className="-rotate-2 inline-block px-1 font-script text-[1.3em] leading-none text-fuchsia-600 dark:text-pink-400">We&rsquo;re</span>{' '}
              here to help you{' '}
              <Flame className="mx-0.5 inline-block h-[0.8em] w-[0.8em] -translate-y-[0.06em] text-orange-500 dark:text-orange-400" aria-hidden="true" />{' '}
              <span className="-rotate-1 inline-block px-1 font-script text-[1.3em] leading-none text-fuchsia-600 dark:text-pink-400">Turn</span>{' '}
              your passion for Pokémon into something{' '}
              <span className="rotate-1 inline-block px-1 font-script text-[1.3em] leading-none text-fuchsia-600 dark:text-pink-400">Real</span>
              <Sparkles className="mx-1 inline-block h-[0.85em] w-[0.85em] -translate-y-[0.08em] text-amber-500 dark:text-amber-300" aria-hidden="true" />
              <Link
                to="/catalog"
                className="animate-tcg-bob motion-reduce:animate-none mx-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2 align-middle text-base font-bold text-white shadow-[0_14px_34px_-10px_rgba(192,38,211,0.55)] ring-1 ring-white/40 transition-shadow hover:shadow-[0_18px_40px_-10px_rgba(192,38,211,0.7)]"
              >
                Shop Now! <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </p>
            <p className="mx-auto mt-5 max-w-xl text-sm text-ink-600 dark:text-purple-200/70 animate-tcg-reveal sm:text-base" style={{ animationDelay: '0.36s' }}>
              From graded singles to sealed boxes, every card is authenticated and ready for its new binder.
            </p>
          </div>

          {/* Power types dock */}
          <div className="mt-14 pb-20 sm:mt-16 sm:pb-24">
            <h2 className="sr-only">Browse by power type</h2>
            <div
              className="animate-tcg-reveal mx-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-transparent bg-white/70 px-4 py-3 shadow-lg ring-1 ring-white/70 backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] dark:ring-white/10 sm:justify-center sm:px-6"
              role="list"
              aria-label="Elemental power types"
              style={{ animationDelay: '0.42s' }}
            >
              {POWER_TYPES.map(({ id, label, Icon, iconCls }) => (
                <span
                  key={id}
                  role="listitem"
                  aria-label={`${label} type`}
                  className="group inline-flex shrink-0 cursor-default select-none items-center gap-2 rounded-full px-3 py-1.5 transition-[transform,background-color] duration-300 ease-out hover:-translate-y-1.5 hover:bg-white/80 dark:hover:bg-white/10 motion-reduce:transition-none"
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br shadow-sm transition-transform duration-300 group-hover:scale-110 ${iconCls}`}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-semibold text-ink-700 dark:text-purple-100">{label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FEATURES ===================== */}
      <section className="relative -mt-6 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="flex items-center gap-4 p-5 surface rounded-2xl hover:-translate-y-1 transition-all duration-300 animate-tcg-reveal hover:ring-iridescent dark:bg-white/5 dark:border-white/10 dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                style={{ animationDelay: `${0.1 + i * 0.06}s` }}
              >
                <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-fuchsia-50 to-violet-100 dark:from-white/10 dark:to-aura-violet/20 flex items-center justify-center">
                  <f.icon className="h-6 w-6 text-fuchsia-600 dark:text-fuchsia-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-strong dark:text-white">{f.title}</h3>
                  <p className="text-sm text-muted dark:text-purple-200/70">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CATEGORIES ===================== */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="section-eyebrow dark:from-pink-400 dark:to-purple-400">Collections</p>
              <h2 className="mt-2 heading-display text-3xl dark:text-white">Shop by category</h2>
            </div>
            <Link to="/catalog" className="text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400 dark:hover:text-white font-medium flex items-center shrink-0">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
            {SHOP_CATEGORIES.map(({ key, slug, name, tagline, Icon, iconCls }, i) => {
              const count = categoryCount(slug);
              return (
                <Link
                  key={key}
                  to={`/catalog?category=${slug}`}
                  className="group relative overflow-hidden rounded-3xl h-36 sm:h-44 flex flex-col items-center justify-center text-center p-5 surface hover:-translate-y-1 transition-all duration-300 animate-tcg-reveal dark:bg-white/5 dark:border-white/10 dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
                  style={{ animationDelay: `${i * 0.06}s` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/0 to-violet-500/0 group-hover:from-fuchsia-500/20 group-hover:to-violet-500/20 dark:group-hover:from-fuchsia-500/15 dark:group-hover:to-purple-500/15 transition-colors duration-500" />
                  <div aria-hidden="true" className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-purple-600/0 blur-2xl transition-colors duration-500 group-hover:bg-purple-600/20 dark:bg-purple-600/10" />
                  <span className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300 ${iconCls}`}>
                    <Icon className="h-7 w-7 text-white" aria-hidden="true" />
                  </span>
                  <span className="relative mt-3 font-display text-lg font-bold text-strong dark:text-white group-hover:text-fuchsia-700 dark:group-hover:text-pink-300 transition-colors">{name}</span>
                  <span className="relative mt-1 text-xs text-muted dark:text-purple-200/70">{tagline}</span>
                  {count !== null && (
                    <span className="relative mt-1.5 text-[11px] font-semibold text-faint dark:text-purple-200/50">{count} products</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== FEATURED PRODUCTS ===================== */}
      <section className="py-20 bg-gradient-to-b from-transparent to-primary-50/30 dark:to-purple-500/[0.03]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="section-eyebrow dark:from-pink-400 dark:to-purple-400">Hot Picks</p>
              <h2 className="mt-2 heading-display text-3xl dark:text-white">Featured Products</h2>
            </div>
            <Link to="/catalog" className="text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-400 dark:hover:text-white font-medium flex items-center shrink-0">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="rounded-3xl surface p-2 animate-pulse dark:bg-white/5 dark:border-white/10 dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                  <div className="h-64 bg-ink-100 dark:bg-white/5 rounded-2xl mb-3" />
                  <div className="h-4 bg-ink-100 dark:bg-white/5 rounded w-3/4 mx-auto mb-2" />
                  <div className="h-5 bg-ink-100 dark:bg-white/5 rounded w-1/3 mx-auto" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center text-rose-500 dark:text-rose-400 py-12">{error}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProducts.map((product) => (
                <HoloCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===================== PROMO / CTA ===================== */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-violet-700 via-fuchsia-600 to-pink-500 text-white p-8 sm:p-14 text-center dark:from-[#1b0f33] dark:via-[#150b28] dark:to-[#0d0714] dark:ring-1 dark:ring-white/10">
            <div className="absolute -top-20 -right-10 h-72 w-72 rounded-full bg-white/15 blur-[100px] animate-tcg-float dark:bg-purple-600/25" />
            <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-pink-300/20 blur-[100px] animate-tcg-float-slow dark:bg-fuchsia-600/20" />
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="relative">
              <Sparkles className="h-10 w-10 mx-auto text-pink-100 dark:text-purple-200" />
              <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold">Ready to expand your collection?</h2>
              <p className="mt-3 text-white/80 max-w-xl mx-auto">Browse our catalog and find your next chase card.</p>
              <Link to="/catalog" className="btn-aura mt-8">
                Explore Catalog <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
