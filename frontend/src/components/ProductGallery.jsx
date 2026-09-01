import React, { useState } from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import TiltCard from './TiltCard';
import ProductImage from './ProductImage';
import RarityBadge from './RarityBadge';
import { isCardProduct } from '../utils/productDataParser';

/**
 * ProductGallery — the premium 3D product preview.
 *
 * • Strict 2.5:3.5 (5:7) aspect frame for single cards; boxes use a
 *   comfortable 4:3 stage so sealed packaging fills the frame naturally.
 * • Padding is driven by the frame (not the img), so any artwork
 *   aspect ratio is letterboxed cleanly with zero distortion.
 * • Dark glass stage, rarity-tinted neon aura, spring-physics 3D tilt.
 * • Front/back toggle + thumbnail selector beneath the preview.
 */
const ProductGallery = ({ product }) => {
  const [face, setFace] = useState('front');

  const isCard = isCardProduct(product);
  const frontSrc = product?.images && product.images.length > 0 ? product.images[0] : null;
  const backSrc = product?.backImage || null;
  const hasBack = Boolean(backSrc);
  const activeSrc = face === 'back' && backSrc ? backSrc : frontSrc;
  const activeLabel = product?.shortName || product?.name || 'No image';

  const faces = [
    { key: 'front', label: 'Front', icon: RotateCw, disabled: !frontSrc },
    { key: 'back', label: 'Back', icon: RotateCcw, disabled: !hasBack }
  ].filter((f) => !f.disabled);

  return (
    <div className="lg:sticky lg:top-24">
      {/* ── 3D stage ──────────────────────────────────────────── */}
      <div className="relative rounded-3xl glass-panel-strong aura-glow">
        {/* ambient aura blobs — soft radial mask fades each glow to
            transparent well before its own edge, so no overflow-hidden
            wrapper is needed and nothing gets a hard clip line */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-400/15 blur-[80px] animate-tcg-float glow-soft-mask" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-primary-400/15 blur-[80px] animate-tcg-float-slow glow-soft-mask" />

        {/* rarity ribbon */}
        {product?.rarity && (
          <div className="absolute top-4 left-4 z-20">
            <RarityBadge rarity={product.rarity} size="lg" />
          </div>
        )}

        {/* face switch (top-right) */}
        {faces.length > 1 && (
          <div className="absolute top-4 right-4 z-20 flex gap-1.5 rounded-full glass-panel p-1">
            {faces.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFace(f.key)}
                aria-pressed={face === f.key}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                  face === f.key
                    ? 'bg-gradient-to-r from-primary-600 to-fuchsia-600 text-white shadow-[0_4px_14px_-4px_rgba(124,58,237,0.55)]'
                    : 'text-muted hover:text-strong'
                }`}
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* aspect-locked stage: 5:7 for cards, 4:3 for boxes/unknown */}
        <div
          className={`relative mx-auto flex items-center justify-center px-6 py-10 sm:px-9 sm:py-12 ${
            isCard ? 'pd-card-stage' : 'pd-box-stage'
          }`}
        >
          <div className={isCard ? 'pd-card-frame' : 'pd-box-frame'}>
            <TiltCard
              max={14}
              scale={1.05}
              rarity={product?.rarity}
              breakout
              seed={product?.name?.length || 7}
              className="h-full w-full rounded-[1.25rem]"
            >
              <ProductImage
                src={activeSrc}
                alt={`${product?.name || 'Product'} — ${face} side`}
                className="h-full w-full object-contain pd-artwork"
                fallbackClassName="pd-fallback"
                iconClassName="h-12 w-12 text-white/90"
                label={activeLabel}
              />
            </TiltCard>
          </div>
        </div>
      </div>

      {/* ── Thumbnail selector beneath the stage ──────────────── */}
      {faces.length > 0 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          {faces.map((f) => {
            const src = f.key === 'back' ? backSrc : frontSrc;
            const isActive = face === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFace(f.key)}
                aria-pressed={isActive}
                aria-label={`Show ${f.label}`}
                className={`group relative overflow-hidden rounded-xl ring-1 transition-all duration-300 ${
                  isActive
                    ? 'ring-2 ring-primary-500 shadow-[0_0_18px_-4px_rgba(139,92,246,0.5)] -translate-y-0.5'
                    : 'ring-white/20 dark:ring-white/10 opacity-70 hover:opacity-100 hover:ring-primary-400/50'
                } ${isCard ? 'aspect-[5/7]' : 'aspect-[4/3]'} w-16`}
              >
                {src ? (
                  <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="img-fallback-holo h-full w-full" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-white/90">
                  {f.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
