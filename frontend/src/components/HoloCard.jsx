import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Sparkles } from 'lucide-react';
import TiltCard from './TiltCard';
import ProductImage from './ProductImage';
import CategoryBadge from './CategoryBadge';
import { formatVND } from '../utils/format';

const getMinPrice = (product) => {
  if (product.variants && product.variants.length > 0) {
    const prices = product.variants.map((v) => Number(v.price)).filter((p) => Number.isFinite(p));
    if (prices.length) return Math.min(...prices);
  }
  return null;
};

const getStock = (product) => {
  if (product.variants) return product.variants.reduce((s, v) => s + (Number(v.stockQuantity) || 0), 0);
  return 0;
};

/**
 * HoloCard — premium product card with the VIP PRO hover stack.
 * Artwork sits on a TiltCard whose rAF loop drives:
 *   dynamic holographic sheen, chasing rarity-neon edge light,
 *   breakout particles, a 100ms micro-glitch activation on entry,
 *   and true parallax depth — background art, card frame and text
 *   each live at different translateZ offsets under 1200px
 *   perspective, so they drift at different rates while tilting.
 */
const HoloCard = ({ product, sealed = false, className = '' }) => {
  const price = getMinPrice(product);
  const stock = getStock(product);
  const inStock = stock > 0;
  const image = product.images && product.images.length > 0 ? product.images[0] : null;
  const rarityKey = String(product.rarity || '').toLowerCase();
  const isChase = rarityKey.includes('secret') || rarityKey.includes('rainbow') ||
    rarityKey.includes('illustration') || rarityKey.includes('hyper') ||
    rarityKey.includes('ultra') || rarityKey.includes('special') ||
    rarityKey.includes('holo');

  return (
    <Link
      to={`/product/${product.id}`}
      className={`group relative block rounded-3xl p-2 glass-panel transition-[transform,box-shadow] duration-500 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:shadow-card-hover dark:bg-white/5 dark:border-white/10 dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] dark:hover:shadow-[0_24px_60px_-12px_rgba(34,211,238,0.28)] ${className}`}
    >
      {/* Ambient aura behind chase-rarity cards */}
      <div
        className={`pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full blur-3xl transition-opacity duration-500 ${
          isChase
            ? 'bg-gradient-to-br from-aura-cyan/40 to-aura-magenta/40 opacity-40 group-hover:opacity-90'
            : 'bg-aura-violet/25 opacity-0 group-hover:opacity-80'
        }`}
      />
      {isChase && (
        <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-aura-gold/20 blur-3xl opacity-0 group-hover:opacity-70 transition-opacity duration-700" />
      )}

      <TiltCard
        className="relative rounded-2xl bg-gradient-to-br from-white/70 to-primary-50/40 dark:from-white/5 dark:to-aura-violet/10 p-4"
        max={12}
        scale={1.05}
        foil={isChase}
        spotlight
        rarity={product.rarity}
        breakout
        seed={String(product.id).length + 5}
      >
        {/* Binary category badge — deepest parallax layer */}
        <div className="absolute top-3 left-3 z-20 vip-depth-pop" style={{ transform: 'translateZ(52px)' }}>
          <CategoryBadge category={product.category} rarity={product.rarity} />
        </div>
        {sealed && (
          <span
            className="foil-sheen absolute top-3 right-3 z-20 inline-flex items-center gap-1 rounded-full bg-white/85 dark:bg-black/40 backdrop-blur px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-300/50 shadow-sm"
            style={{ transform: 'translateZ(46px)' }}
          >
            <ShieldCheck className="h-3 w-3" /> Sealed
          </span>
        )}

        {/* Artwork — mid parallax layer, drifts slower than the frame */}
        <div
          className="sheen-sweep relative h-60 sm:h-64 flex items-center justify-center rounded-xl vip-depth-mid"
          style={{ transform: 'translateZ(16px)' }}
        >
          <ProductImage
            src={image}
            alt={product.shortName || product.name}
            loading="lazy"
            icon={Sparkles}
            iconClassName="h-10 w-10 text-white/90"
            label={product.shortName || product.name || 'No image'}
            className="max-h-full w-auto object-contain drop-shadow-[0_18px_30px_rgba(15,23,42,0.25)] group-hover:drop-shadow-[0_22px_40px_rgba(217,70,239,0.5)] dark:drop-shadow-[0_18px_35px_rgba(0,0,0,0.6)]"
            skeletonClassName="rounded-xl"
          />
        </div>
      </TiltCard>

      {/* Text block — lifted above the tilt scene at its own rate */}
      <div className="px-3 pb-3 pt-3 text-center">
        <h3 className="font-semibold truncate text-ink-900 dark:text-white" title={product.shortName || product.name}>
          {product.shortName || product.name}
        </h3>
        <div className="mt-2 flex items-center justify-center gap-2">
          <span className="text-lg font-bold bg-gradient-to-r from-fuchsia-600 via-violet-500 to-cyan-500 dark:from-pink-400 dark:via-purple-400 dark:to-fuchsia-400 bg-clip-text text-transparent">
            {price !== null ? formatVND(price) : 'Contact us'}
          </span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${inStock ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-400/10 dark:text-emerald-300' : 'text-rose-600 bg-rose-50 dark:bg-rose-400/10 dark:text-rose-300'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {inStock ? `${stock} in stock` : 'Out of stock'}
          </span>
        </div>
      </div>
    </Link>
  );
};

export default HoloCard;
