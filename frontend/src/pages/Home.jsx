import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Shield, Truck, CreditCard, Zap, Sparkles, Layers } from 'lucide-react';
import api from '../services/api';
import HoloCard from '../components/HoloCard';
import TiltCard from '../components/TiltCard';
import RarityBadge from '../components/RarityBadge';

/* Floating booster box — pure CSS 3D collectible with foil security seal */
const BoosterBox = ({ label, gradient, delay = 0, className = '' }) => (
  <div className={`${className} animate-tcg-float`} style={{ animationDelay: `${delay}s` }}>
    <TiltCard max={18} scale={1.06} className="relative w-40 sm:w-48 rounded-2xl">
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden aura-glow" style={{ backgroundImage: gradient }}>
        <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        {/* top sheen */}
        <div className="absolute top-0 inset-x-0 h-1/3 bg-gradient-to-b from-white/40 to-transparent" />
        {/* foil security seal */}
        <span className="foil-sheen absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/85 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-violet-700 shadow ring-1 ring-violet-200">
          <Shield className="h-3 w-3" /> Sealed
        </span>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="font-display text-sm font-bold text-white drop-shadow">{label}</p>
          <p className="text-[10px] text-white/70">Booster Box · 36 Packs</p>
        </div>
      </div>
    </TiltCard>
  </div>
);

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const heroRef = useRef(null);

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

  const features = [
    { icon: Shield, title: 'Authenticity Guaranteed', desc: 'Every card is verified' },
    { icon: Truck, title: 'Fast Shipping', desc: 'Worldwide delivery available' },
    { icon: CreditCard, title: 'Secure Payment', desc: 'SePay bank transfer' },
    { icon: Star, title: 'Top Rated', desc: 'Trusted by collectors worldwide' }
  ];

  return (
    <div className="app-bg min-h-screen">
      {/* ===================== HERO ===================== */}
      <section ref={heroRef} className="relative overflow-hidden" style={{ '--scroll': scrollY }}>
        {/* Ambient obsidian/aura wash */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-fuchsia-700 to-pink-600 dark:from-[#0a0a0f] dark:via-[#15101f] dark:to-[#0a0a0f] transition-colors duration-700" />
        {/* Aura glows — drift with scroll (parallax) */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-pink-500/40 blur-[120px] animate-tcg-float dark:bg-aura-magenta/30" style={{ transform: `translateY(${scrollY * 0.25}px)` }} />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-violet-500/40 blur-[130px] animate-tcg-float-slow dark:bg-aura-violet/30" style={{ transform: `translateY(${scrollY * -0.18}px)` }} />
        <div className="pointer-events-none absolute top-1/3 right-1/4 h-48 w-48 rounded-full bg-cyan-400/30 blur-[90px] animate-tcg-float dark:bg-aura-cyan/25" style={{ transform: `translateY(${scrollY * 0.12}px)` }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            {/* Copy */}
            <div className="text-center lg:text-left">
              <div className="animate-tcg-reveal inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur-md px-4 py-1.5 text-sm font-medium text-white/90 dark:bg-white/5 dark:ring-white/15">
                <Zap className="h-4 w-4 text-pink-300" />
                Premium TCG Marketplace
              </div>
              <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] font-display text-white dark:text-white">
                <span className="anim-word-rise inline-block" style={{ animationDelay: '0.05s' }}>Collect.</span>{' '}
                <span className="anim-word-rise inline-block" style={{ animationDelay: '0.18s' }}>Trade.</span>{' '}
                <span className="anim-word-rise inline-block relative" style={{ animationDelay: '0.31s' }}>
                  <span className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[120%] w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-400/25 blur-2xl anim-word-breathe dark:bg-aura-magenta/30" />
                  <span className="group/dominate relative inline-block cursor-default">
                    <span className="relative z-10 text-gradient-sweep transition-transform duration-500 ease-out group-hover/dominate:-translate-y-1 inline-block">
                      Dominate.
                    </span>
                    <span className="pointer-events-none absolute -bottom-2 left-0 z-0 h-[3px] w-full rounded-full bg-gradient-to-r from-pink-300 via-fuchsia-200 to-violet-300 anim-beam-draw" style={{ animationDelay: '1.1s' }} />
                  </span>
                  <span className="pointer-events-none absolute -right-4 -top-3 h-2 w-2 rounded-full bg-pink-200 anim-spark" style={{ animationDelay: '0.8s' }} />
                  <span className="pointer-events-none absolute -left-5 top-1/4 h-1.5 w-1.5 rounded-full bg-violet-200 anim-spark" style={{ animationDelay: '1.9s' }} />
                  <span className="pointer-events-none absolute right-8 -top-6 h-1 w-1 rounded-full bg-white anim-spark" style={{ animationDelay: '2.7s' }} />
                </span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-white/75 max-w-2xl mx-auto lg:mx-0 animate-tcg-reveal" style={{ animationDelay: '0.1s' }}>
                Your premier destination for Trading Card Game singles, booster boxes, and rare collectibles.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row justify-center lg:justify-start gap-4 animate-tcg-reveal" style={{ animationDelay: '0.15s' }}>
                <Link to="/catalog" className="btn-aura animate-tcg-pulse-ring">
                  Shop Now <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <Link to="/order-lookup" className="inline-flex items-center justify-center px-8 py-3.5 border border-white/30 bg-white/10 backdrop-blur-md text-white font-semibold rounded-full hover:bg-white/20 transition-all dark:border-white/15">
                  Track Order
                </Link>
              </div>
            </div>

            {/* 3D floating booster boxes (parallax) */}
            <div className="relative hidden lg:flex items-center justify-center h-[420px]" style={{ transform: `translateY(${scrollY * -0.06}px)` }}>
              <BoosterBox
                label="Scarlet & Violet"
                gradient="linear-gradient(135deg,#7c3aed,#d946ef)"
                className="absolute left-6 top-10 animate-tcg-float"
                delay={0}
              />
              <BoosterBox
                label="Paldean Fates"
                gradient="linear-gradient(135deg,#0ea5e9,#8b5cf6)"
                className="absolute right-4 top-0 animate-tcg-float-slow"
                delay={0.6}
              />
              <BoosterBox
                label="Crown Zenith"
                gradient="linear-gradient(135deg,#f59e0b,#ec4899)"
                className="absolute left-1/3 bottom-2 animate-tcg-float"
                delay={1.2}
              />
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
