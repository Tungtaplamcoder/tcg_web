import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Shield, Truck, CreditCard, Star, Zap, Sparkles, Layers
} from 'lucide-react';
import api from '../services/api';
import { formatVND } from '../utils/format';

/* Derive display price from variants (price lives on ProductVariant, not Product) */
const getMinPrice = (product) => {
  if (product.variants && product.variants.length > 0) {
    const prices = product.variants.map((v) => Number(v.price)).filter((p) => Number.isFinite(p));
    if (prices.length) return Math.min(...prices);
  }
  return null;
};

/* Derive total stock + in-stock flag from variants */
const getStock = (product) => {
  if (product.variants) {
    return product.variants.reduce((sum, v) => sum + (Number(v.stockQuantity) || 0), 0);
  }
  return 0;
};

const ProductCard = ({ product }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [randomZ, setRandomZ] = useState(0);
  const [flipDirection, setFlipDirection] = useState(1);

  const price = getMinPrice(product);
  const stock = getStock(product);

  const handleMouseEnter = () => {
    setRandomZ(Math.random() * 12 - 6);
    setFlipDirection(Math.random() > 0.5 ? 1 : -1);
    setIsFlipped(true);
  };
  const handleMouseLeave = () => setIsFlipped(false);

  return (
    <Link
      to={`/product/${product.id}`}
      className="group relative block rounded-3xl p-1.5 bg-gradient-to-b from-white/90 to-white/60 ring-1 ring-gray-100 shadow-card hover:shadow-card-hover hover:-translate-y-1.5 transition-all duration-500"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div style={{ perspective: '1200px' }}>
        <div
          className="relative w-full h-72 transition-all duration-700 ease-[cubic-bezier(0.4,0.2,0.2,1)] rounded-2xl"
          style={{ transformStyle: 'preserve-3d', transform: isFlipped ? `rotateY(${360 * flipDirection}deg) rotateZ(${randomZ}deg) scale(1.08)` : 'rotateY(0deg) rotateZ(0deg) scale(1)' }}
        >
          {/* front face */}
          <div className="absolute inset-0 bg-transparent rounded-2xl flex items-center justify-center" style={{ backfaceVisibility: 'hidden' }}>
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[0]}
                alt={product.shortName || product.name}
                className={`w-full h-full object-contain drop-shadow-2xl ${isFlipped ? 'drop-shadow-[0_0_20px_rgba(217,70,239,0.45)]' : ''}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">No image</div>
            )}
          </div>
          {/* back face */}
          <div className="absolute inset-0 bg-transparent rounded-2xl flex items-center justify-center" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            {product.backImage ? (
              <img
                src={product.backImage}
                alt="back"
                className={`w-full h-full object-contain drop-shadow-2xl ${isFlipped ? 'drop-shadow-[0_0_20px_rgba(217,70,239,0.45)]' : ''}`}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">Không có ảnh sau</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 text-center w-full px-3 pb-3">
        <h3 className="font-semibold text-gray-900 truncate" title={product.shortName || product.name}>
          {product.shortName || product.name}
        </h3>
        <p className="text-xl font-bold bg-gradient-to-r from-fuchsia-600 to-violet-600 bg-clip-text text-transparent mt-1">
          {price !== null ? formatVND(price) : 'Liên hệ'}
        </p>
      </div>
    </Link>
  );
};

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const features = [
    { icon: Shield, title: 'Authenticity Guaranteed', desc: 'Every card is verified' },
    { icon: Truck, title: 'Fast Shipping', desc: 'Worldwide delivery available' },
    { icon: CreditCard, title: 'Secure Payment', desc: 'SePay bank transfer' },
    { icon: Star, title: 'Top Rated', desc: 'Trusted by collectors worldwide' }
  ];

  return (
    <div className="bg-white">
      {/* ===================== HERO ===================== */}
      <section className="relative overflow-hidden bg-[#140022] text-white">
        {/* Static gradient wash — kept strictly within bounds (no drift to avoid edge bleed) */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-fuchsia-700 to-pink-600" />
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-pink-500/40 blur-[120px] animate-tcg-float" />
        <div className="absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-violet-500/40 blur-[130px] animate-tcg-float-slow" />
        <div className="absolute top-1/3 right-1/4 h-48 w-48 rounded-full bg-fuchsia-400/30 blur-[90px] animate-tcg-float" />
        {/* Subtle grid texture */}
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        {/* Floating decorative card silhouettes (pure CSS, no assets) */}
        <div className="pointer-events-none absolute left-[8%] top-[18%] hidden lg:block animate-tcg-float-slow">
          <div className="h-40 w-28 rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm rotate-[-14deg]" />
        </div>
        <div className="pointer-events-none absolute right-[10%] top-[24%] hidden lg:block animate-tcg-float">
          <div className="h-40 w-28 rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-sm rotate-[12deg]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:px-6 lg:px-8 lg:py-32 text-center">
          <div className="animate-tcg-reveal">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur-md px-4 py-1.5 text-sm font-medium text-white/90">
              <Zap className="h-4 w-4 text-pink-300" />
              Premium TCG Marketplace
            </span>
          </div>
          <h1 className="mt-6 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] font-display">
            <span className="anim-word-rise inline-block" style={{ animationDelay: '0.05s' }}>
              Collect.
            </span>
            {' '}
            <span className="anim-word-rise inline-block" style={{ animationDelay: '0.18s' }}>
              Trade.
            </span>
            {' '}
            <span className="anim-word-rise inline-block relative" style={{ animationDelay: '0.31s' }}>
              <span className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[120%] w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-400/25 blur-2xl anim-word-breathe" />
              <span className="group/dominate relative inline-block cursor-default">
                <span className="relative z-10 text-gradient-sweep transition-transform duration-500 ease-out group-hover/dominate:-translate-y-1 inline-block">
                  Dominate.
                </span>
                <span
                  className="pointer-events-none absolute -bottom-2 left-0 z-0 h-[3px] w-full rounded-full bg-gradient-to-r from-pink-300 via-fuchsia-200 to-violet-300 anim-beam-draw"
                  style={{ animationDelay: '1.1s' }}
                />
              </span>
              <span className="pointer-events-none absolute -right-4 -top-3 h-2 w-2 rounded-full bg-pink-200 anim-spark" style={{ animationDelay: '0.8s' }} />
              <span className="pointer-events-none absolute -left-5 top-1/4 h-1.5 w-1.5 rounded-full bg-violet-200 anim-spark" style={{ animationDelay: '1.9s' }} />
              <span className="pointer-events-none absolute right-8 -top-6 h-1 w-1 rounded-full bg-white anim-spark" style={{ animationDelay: '2.7s' }} />
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-white/75 max-w-2xl mx-auto animate-tcg-reveal" style={{ animationDelay: '0.1s' }}>
            Your premier destination for Trading Card Game singles, booster boxes, and rare collectibles.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row justify-center gap-4 animate-tcg-reveal" style={{ animationDelay: '0.15s' }}>
            <Link
              to="/catalog"
              className="inline-flex items-center justify-center px-8 py-3.5 bg-white text-[#7c22ce] font-semibold rounded-full shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all animate-tcg-pulse-ring"
            >
              Shop Now <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
              to="/order-lookup"
              className="inline-flex items-center justify-center px-8 py-3.5 border border-white/30 bg-white/10 backdrop-blur-md text-white font-semibold rounded-full hover:bg-white/20 transition-all"
            >
              Track Order
            </Link>
          </div>
        </div>

        {/* bottom fade into page */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-white" />
      </section>

      {/* ===================== FEATURES ===================== */}
      <section className="relative -mt-6 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="flex items-center gap-4 p-5 bg-white/90 backdrop-blur-xl rounded-2xl ring-1 ring-gray-100 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 animate-tcg-reveal"
                style={{ animationDelay: `${0.1 + i * 0.06}s` }}
              >
                <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-fuchsia-50 to-violet-100 flex items-center justify-center">
                  <f.icon className="h-6 w-6 text-fuchsia-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800">{f.title}</h3>
                  <p className="text-sm text-gray-500">{f.desc}</p>
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
                <p className="text-sm font-semibold uppercase tracking-widest text-fuchsia-600">Collections</p>
                <h2 className="mt-2 text-3xl font-bold text-gray-900">Shop by category</h2>
              </div>
              <Link to="/catalog" className="text-fuchsia-600 hover:text-fuchsia-700 font-medium flex items-center shrink-0">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {categories.slice(0, 5).map((cat, i) => (
                <Link
                  key={cat.id}
                  to={`/catalog?category=${encodeURIComponent(cat.slug || cat.name)}`}
                  className="group relative overflow-hidden rounded-2xl h-32 flex flex-col items-center justify-center text-center p-4 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10 ring-1 ring-gray-100 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/0 to-violet-500/0 group-hover:from-fuchsia-500/20 group-hover:to-violet-500/20 transition-colors duration-500" />
                  <Layers className="h-8 w-8 text-fuchsia-600 group-hover:scale-110 transition-transform duration-300" />
                  <span className="mt-2 font-semibold text-gray-800 group-hover:text-fuchsia-700 transition-colors">{cat.name}</span>
                  <span className="text-xs text-gray-500">{cat._count?.products ?? ''}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===================== FEATURED PRODUCTS ===================== */}
      <section className="py-20 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-fuchsia-600">Hot Picks</p>
              <h2 className="mt-2 text-3xl font-bold text-gray-900">Sản phẩm nổi bật</h2>
            </div>
            <Link to="/catalog" className="text-fuchsia-600 hover:text-fuchsia-700 font-medium flex items-center shrink-0">
              View All <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, idx) => (
                <div key={idx} className="rounded-3xl ring-1 ring-gray-100 shadow-card p-1.5 animate-pulse">
                  <div className="h-72 bg-gray-200 rounded-2xl mb-3" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2" />
                  <div className="h-5 bg-gray-200 rounded w-1/3 mx-auto" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center text-red-500 py-12">{error}</div>
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
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-violet-700 via-fuchsia-600 to-pink-500 text-white p-8 sm:p-14 text-center">
            <div className="absolute -top-20 -right-10 h-72 w-72 rounded-full bg-white/15 blur-[100px] animate-tcg-float" />
            <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-pink-300/20 blur-[100px] animate-tcg-float-slow" />
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            <div className="relative">
              <Sparkles className="h-10 w-10 mx-auto text-pink-100" />
              <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold">Ready to expand your collection?</h2>
              <p className="mt-3 text-white/80 max-w-xl mx-auto">Browse our catalog and find your next chase card.</p>
              <Link
                to="/catalog"
                className="mt-8 inline-flex items-center px-8 py-3.5 bg-white text-[#7c22ce] font-semibold rounded-full shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all"
              >
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
