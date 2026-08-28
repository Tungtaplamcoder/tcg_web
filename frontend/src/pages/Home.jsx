import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Truck, CreditCard, Star, Zap, Sparkles, Layers } from 'lucide-react';
import api from '../services/api';
import HoloCard from '../components/HoloCard';
import TiltCard from '../components/TiltCard';
import RarityBadge from '../components/RarityBadge';
import { formatVND } from '../utils/format';

/* ── True-3D booster box (front / side / top faces, cursor + scroll parallax) ── */
const BOX_W = 172;
const BOX_H = 128;
const BOX_D = 66;

const faceBase = {
  position: 'absolute',
  borderRadius: '10px',
  overflow: 'hidden',
  backfaceVisibility: 'hidden'
};

const BoosterBox3D = ({ label, gradient, accent = 'rgba(255,255,255,0.25)', floatDelay = 0, floatDuration = 7 }) => (
  <div className="relative">
    {/* Grounding contact shadow */}
    <div
      aria-hidden="true"
      className="absolute left-1/2 -translate-x-1/2 h-6 rounded-[100%] bg-black/25 blur-md dark:bg-black/60"
      style={{ top: BOX_H + 26, width: BOX_W * 0.78 }}
    />
    <div
      className="group animate-tcg-float will-change-transform"
      style={{ animationDelay: `${floatDelay}s`, animationDuration: `${floatDuration}s` }}
    >
    <div
      className="box3d"
      style={{
        width: BOX_W,
        height: BOX_H,
        transform: `rotateX(calc(-9deg + var(--prx, 0deg))) rotateY(calc(26deg + var(--pry, 0deg)))`
      }}
    >
      {/* front */}
      <div className="sheen-sweep" style={{ ...faceBase, inset: 0, backgroundImage: gradient, transform: `translateZ(${BOX_D / 2}px)`, boxShadow: '0 30px 60px -18px rgba(0,0,0,0.55)' }}>
        <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        <div className="absolute inset-x-0 top-2 h-1.5 rounded-full bg-white/30 mx-3" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="h-9 w-9 text-white/85 drop-shadow" />
        </div>
        <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/45 to-transparent">
          <p className="font-display text-[12px] font-bold text-white leading-tight drop-shadow">{label}</p>
          <p className="text-[9px] text-white/75">Booster Box · 36 Packs</p>
        </div>
        <span className="foil-sheen absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-700 shadow ring-1 ring-violet-200">
          <Shield className="h-2.5 w-2.5" /> Sealed
        </span>
      </div>
      {/* right side */}
      <div style={{ ...faceBase, top: 0, right: 0, width: BOX_D, height: BOX_H, backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.28), rgba(0,0,0,0.5)), ${gradient}`, transform: `rotateY(90deg) translateZ(${BOX_W - BOX_D / 2}px)` }} />
      {/* top lid */}
      <div style={{ ...faceBase, top: 0, left: 0, width: BOX_W, height: BOX_D, backgroundImage: `linear-gradient(120deg, rgba(255,255,255,0.34), rgba(255,255,255,0.06) 55%), ${gradient}`, transform: `rotateX(90deg) translateZ(${BOX_D / 2}px)`, border: `1px solid ${accent}` }} />
      </div>
    </div>
  </div>
);

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const heroRef = useRef(null);
  const heroFrame = useRef(null);

  useEffect(() => {
    let active = true;
    const fetchFeatured = async () => {
      try {
        setLoading(true);
        const response = await api.get('/products?page=1&limit=4&sortBy=createdAt&order=desc');
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
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Cursor-driven parallax across the whole hero stage */
  const handleHeroMove = useCallback((e) => {
    const el = heroRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    if (heroFrame.current) cancelAnimationFrame(heroFrame.current);
    heroFrame.current = requestAnimationFrame(() => setParallax({ x: px, y: py }));
  }, []);

  /* Feed cursor delta into box CSS vars for 3D rotation response */
  const boxVars = {
    '--prx': `${(parallax.y * -7).toFixed(2)}deg`,
    '--pry': `${(parallax.x * 10).toFixed(2)}deg`
  };

  const features = [
    { icon: Shield, title: 'Authenticity Guaranteed', desc: 'Every card is verified' },
    { icon: Truck, title: 'Fast Shipping', desc: 'Worldwide delivery available' },
    { icon: CreditCard, title: 'Secure Payment', desc: 'SePay bank transfer' },
    { icon: Star, title: 'Top Rated', desc: 'Trusted by collectors worldwide' }
  ];

  return (
    <div className="app-bg min-h-screen">
      {/* ===================== HERO ===================== */}
      <section
        ref={heroRef}
        onMouseMove={handleHeroMove}
        className="relative overflow-hidden"
        style={{ '--scroll': scrollY, ...boxVars }}
      >
        {/* Theme-aware canvas: pearl studio (light) / obsidian vault (dark) */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-[#f4f1fb] to-[#ece7f8] dark:from-[#0a0a0f] dark:via-[#12101c] dark:to-[#0a0a0f] transition-colors duration-700" />
        {/* Holo glimmer wash (light) / aura glows (dark) */}
        <div className="pointer-events-none absolute inset-0 opacity-60 dark:opacity-100">
          <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-fuchsia-200/50 blur-[120px] dark:bg-aura-magenta/30 animate-tcg-drift" style={{ transform: `translateY(${scrollY * 0.18}px)` }} />
          <div className="absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-violet-200/50 blur-[130px] dark:bg-aura-violet/30 animate-tcg-drift" style={{ animationDelay: '2s', transform: `translateY(${scrollY * -0.14}px)` }} />
          <div className="absolute top-1/3 right-1/4 h-48 w-48 rounded-full bg-cyan-200/40 blur-[90px] dark:bg-aura-cyan/25 animate-tcg-float" style={{ transform: `translateY(${scrollY * 0.1}px)` }} />
        </div>
        {/* faint grid texture */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.05] dark:opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(120,90,220,0.9) 1px, transparent 1px), linear-gradient(90deg, rgba(120,90,220,0.9) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* holographic foil glimmer band */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(115deg,transparent_20%,rgba(255,200,240,0.25)_40%,rgba(180,240,255,0.22)_52%,rgba(255,240,200,0.2)_62%,transparent_80%)] dark:hidden" />

        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Copy */}
            <div className="text-center lg:text-left">
              <div className="animate-tcg-reveal inline-flex items-center gap-2 rounded-full bg-white/70 ring-1 ring-primary-200/60 backdrop-blur-md px-4 py-1.5 text-sm font-medium text-primary-800 shadow-sm dark:bg-white/5 dark:ring-white/15 dark:text-white/90">
                <Zap className="h-4 w-4 text-fuchsia-500 dark:text-pink-300" />
                Premium Pokémon TCG Marketplace
              </div>
              <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] font-display text-ink-950 dark:text-white">
                <span className="anim-word-rise inline-block" style={{ animationDelay: '0.05s' }}>Collect.</span>{' '}
                <span className="anim-word-rise inline-block" style={{ animationDelay: '0.18s' }}>Trade.</span>{' '}
                <span className="anim-word-rise inline-block relative" style={{ animationDelay: '0.31s' }}>
                  <span className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[120%] w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-300/30 blur-2xl anim-word-breathe dark:bg-aura-magenta/30" />
                  <span className="group/dominate relative inline-block cursor-default">
                    <span className="relative z-10 text-gradient-brand dark:text-gradient-sweep transition-transform duration-500 ease-out group-hover/dominate:-translate-y-1 inline-block">
                      Dominate.
                    </span>
                    <span className="pointer-events-none absolute -bottom-2 left-0 z-0 h-[3px] w-full rounded-full bg-gradient-to-r from-primary-400 via-fuchsia-400 to-pink-400 anim-beam-draw dark:from-pink-300 dark:via-fuchsia-200 dark:to-violet-300" style={{ animationDelay: '1.1s' }} />
                  </span>
                  <span className="pointer-events-none absolute -right-4 -top-3 h-2 w-2 rounded-full bg-fuchsia-400 anim-spark dark:bg-pink-200" style={{ animationDelay: '0.8s' }} />
                  <span className="pointer-events-none absolute -left-5 top-1/4 h-1.5 w-1.5 rounded-full bg-violet-400 anim-spark dark:bg-violet-200" style={{ animationDelay: '1.9s' }} />
                  <span className="pointer-events-none absolute right-8 -top-6 h-1 w-1 rounded-full bg-amber-400 anim-spark dark:bg-white" style={{ animationDelay: '2.7s' }} />
                </span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-ink-600 dark:text-white/75 max-w-2xl mx-auto lg:mx-0 animate-tcg-reveal" style={{ animationDelay: '0.1s' }}>
                Your premier destination for Pokémon TCG singles, sealed booster boxes, and rare collectibles.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row justify-center lg:justify-start gap-4 animate-tcg-reveal" style={{ animationDelay: '0.15s' }}>
                <Link to="/catalog" className="btn-primary sm:px-8 sm:py-3.5 animate-tcg-pulse-ring">
                  Shop Now <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  to="/order-lookup"
                  className="inline-flex items-center justify-center px-8 py-3.5 border border-ink-900/15 bg-white/60 backdrop-blur-md text-ink-900 dark:text-white font-semibold rounded-full hover:bg-white hover:shadow-glass transition-all dark:border-white/20 dark:bg-white/10 dark:hover:bg-white/20"
                >
                  Track Order
                </Link>
              </div>
              {/* Social proof strip */}
              <div className="mt-10 inline-flex flex-wrap items-center justify-center lg:justify-start gap-x-7 gap-y-2 text-sm font-medium text-ink-500 dark:text-white/60 glass-panel rounded-full px-6 py-3 animate-tcg-reveal" style={{ animationDelay: '0.22s' }}>
                <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> 4.9/5 từ 2.300+ nhà sưu tập</span>
                <span className="hidden sm:inline h-4 w-px bg-ink-900/15 dark:bg-white/15" />
                <span className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-emerald-500" /> 100% chính hãng</span>
              </div>
            </div>

            {/* 3D floating booster boxes (cursor + scroll parallax) */}
            <div
              className="box3d-stage relative hidden lg:flex items-center justify-center h-[440px]"
              style={{ transform: `translate3d(${(parallax.x * -14).toFixed(1)}px, ${scrollY * -0.08 + (parallax.y * -10).toFixed(1)}px, 0)` }}
            >
              <div className="absolute left-2 top-8">
                <BoosterBox3D label="Scarlet & Violet" gradient="linear-gradient(135deg,#7c3aed,#d946ef)" floatDelay={0} floatDuration={7} />
              </div>
              <div className="absolute right-2 top-0">
                <BoosterBox3D label="Paldean Fates" gradient="linear-gradient(135deg,#0ea5e9,#8b5cf6)" floatDelay={0.7} floatDuration={8.5} />
              </div>
              <div className="absolute left-1/3 bottom-0">
                <BoosterBox3D label="Crown Zenith" gradient="linear-gradient(135deg,#f59e0b,#ec4899)" floatDelay={1.3} floatDuration={6.5} />
              </div>
              {/* Real featured product floating in the scene */}
              <div className="absolute right-16 bottom-6 animate-tcg-float-slow" style={{ animationDelay: '0.4s' }}>
                {featuredProducts[0] ? (
                  <Link to={`/product/${featuredProducts[0].id}`} aria-label={featuredProducts[0].shortName || featuredProducts[0].name}>
                    <TiltCard max={24} scale={1.1} foil spotlight className="w-32 rounded-2xl glass-panel-strong shadow-[0_24px_50px_-12px_rgba(124,58,237,0.5)]">
                      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden p-2.5 flex flex-col">
                        <div className="absolute top-2 left-2 z-20" style={{ transform: 'translateZ(40px)' }}>
                          <RarityBadge rarity={featuredProducts[0].rarity} />
                        </div>
                        <div className="flex-1 flex items-center justify-center" style={{ transform: 'translateZ(24px)' }}>
                          {featuredProducts[0].images?.[0] ? (
                            <img
                              src={featuredProducts[0].images[0]}
                              alt={featuredProducts[0].shortName || featuredProducts[0].name}
                              className="max-h-full w-auto object-contain drop-shadow-[0_14px_22px_rgba(0,0,0,0.35)]"
                            />
                          ) : (
                            <Sparkles className="h-7 w-7 text-white/90" />
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-center text-[10px] font-semibold text-strong">
                          {featuredProducts[0].shortName || featuredProducts[0].name}
                        </p>
                        <p className="text-center text-[10px] font-bold bg-gradient-to-r from-fuchsia-600 to-cyan-500 bg-clip-text text-transparent">
                          {(() => {
                            const prices = (featuredProducts[0].variants || []).map(v => Number(v.price)).filter(Number.isFinite);
                            return prices.length ? formatVND(Math.min(...prices)) : '';
                          })()}
                        </p>
                      </div>
                    </TiltCard>
                  </Link>
                ) : (
                  <TiltCard max={24} scale={1.1} foil className="w-24 rounded-xl ring-1 ring-white/40 shadow-[0_24px_50px_-12px_rgba(124,58,237,0.5)]">
                    <div className="aspect-[3/4] rounded-xl bg-gradient-to-br from-cyan-300 via-violet-300 to-fuchsia-300 dark:from-cyan-500/70 dark:via-violet-500/70 dark:to-fuchsia-500/70 flex items-center justify-center">
                      <Sparkles className="h-7 w-7 text-white/90" />
                    </div>
                  </TiltCard>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* bottom fade into page */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-[var(--bg-app)]" />
      </section>

      {/* ===================== FEATURES ===================== */}
      <section className="relative -mt-6 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="flex items-center gap-4 p-5 surface rounded-2xl hover:-translate-y-1 transition-all duration-300 animate-tcg-reveal hover:ring-iridescent"
                style={{ animationDelay: `${0.1 + i * 0.06}s` }}
              >
                <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-fuchsia-50 to-violet-100 dark:from-white/10 dark:to-aura-violet/20 flex items-center justify-center">
                  <f.icon className="h-6 w-6 text-fuchsia-600 dark:text-aura-cyan" />
                </div>
                <div>
                  <h3 className="font-semibold text-strong">{f.title}</h3>
                  <p className="text-sm text-muted">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== CATEGORIES ===================== */}
      {categories.length > 0 && (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="section-eyebrow">Collections</p>
                <h2 className="mt-2 heading-display text-3xl">Shop by category</h2>
              </div>
              <Link to="/catalog" className="text-fuchsia-600 hover:text-fuchsia-700 dark:text-aura-cyan dark:hover:text-white font-medium flex items-center shrink-0">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {categories.slice(0, 5).map((cat, i) => (
                <Link
                  key={cat.id}
                  to={`/catalog?category=${encodeURIComponent(cat.slug || cat.name)}`}
                  className="group relative overflow-hidden rounded-2xl h-32 flex flex-col items-center justify-center text-center p-4 surface hover:-translate-y-1 transition-all duration-300"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/0 to-violet-500/0 group-hover:from-fuchsia-500/20 group-hover:to-violet-500/20 transition-colors duration-500" />
                  <Layers className="h-8 w-8 text-fuchsia-600 dark:text-aura-cyan group-hover:scale-110 transition-transform duration-300" />
                  <span className="mt-2 font-semibold text-strong group-hover:text-fuchsia-700 dark:group-hover:text-white transition-colors">{cat.name}</span>
                  <span className="text-xs text-muted">{cat._count?.products ?? ''}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===================== FEATURED PRODUCTS ===================== */}
      <section className="py-20 bg-gradient-to-b from-transparent to-primary-50/30 dark:to-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="section-eyebrow">Hot Picks</p>
              <h2 className="mt-2 heading-display text-3xl">Sản phẩm nổi bật</h2>
            </div>
            <Link to="/catalog" className="text-fuchsia-600 hover:text-fuchsia-700 dark:text-aura-cyan dark:hover:text-white font-medium flex items-center shrink-0">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="rounded-3xl surface p-2 animate-pulse">
                  <div className="h-64 bg-ink-100 dark:bg-white/5 rounded-2xl mb-3" />
                  <div className="h-4 bg-ink-100 dark:bg-white/5 rounded w-3/4 mx-auto mb-2" />
                  <div className="h-5 bg-ink-100 dark:bg-white/5 rounded w-1/3 mx-auto" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center text-rose-500 py-12">{error}</div>
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
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-violet-700 via-fuchsia-600 to-pink-500 text-white p-8 sm:p-14 text-center dark:from-[#15101f] dark:via-[#1b1230] dark:to-[#0a0a0f] dark:ring-1 dark:ring-white/10">
            <div className="absolute -top-20 -right-10 h-72 w-72 rounded-full bg-white/15 blur-[100px] animate-tcg-float dark:bg-aura-violet/25" />
            <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-pink-300/20 blur-[100px] animate-tcg-float-slow dark:bg-aura-magenta/20" />
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="relative">
              <Sparkles className="h-10 w-10 mx-auto text-pink-100" />
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
