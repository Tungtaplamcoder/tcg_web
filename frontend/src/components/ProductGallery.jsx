import React, { useState, useEffect } from 'react';
import { Package, ChevronLeft, ChevronRight } from 'lucide-react';
import TiltCard from './TiltCard';
import ProductImage from './ProductImage';
import RarityBadge from './RarityBadge';
import { isCardProduct } from '../utils/productDataParser';

/**
 * ProductGallery — the premium dynamic multi-image gallery with 3D product preview.
 *
 * • Showcases the primary/cover image (first image) by default.
 * • Renders a thumbnail preview row below the main image when multiple images exist.
 * • Supports smooth switching by clicking thumbnails or navigation controls.
 * • Strict aspect ratios: 5:7 for cards, 4:3 for boxes/accessories.
 */
const ProductGallery = ({ product, isSealedProduct = false }) => {
  const isCard = isCardProduct(product);
  const sealed = isSealedProduct;

  // Extract all images from product.images array with backward compatibility
  const rawImages = Array.isArray(product?.images) && product.images.length > 0
    ? product.images
    : (product?.frontImage ? [product.frontImage] : []);
  const images = [...rawImages.filter((img) => typeof img === 'string' && img.trim().length > 0)];
  if (product?.backImage && !images.includes(product.backImage)) {
    images.push(product.backImage);
  }

  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selected image when viewing a different product
  useEffect(() => {
    setSelectedIndex(0);
  }, [product?.id]);

  const activeSrc = images[selectedIndex] || images[0] || null;
  const activeLabel = product?.shortName || product?.name || 'No image';

  const handlePrev = () => {
    if (images.length <= 1) return;
    setSelectedIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    if (images.length <= 1) return;
    setSelectedIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="lg:sticky lg:top-24" data-testid="product-gallery">
      {/* ── 3D stage ──────────────────────────────────────────── */}
      <div className="relative rounded-3xl glass-panel-strong aura-glow">
        {/* ambient aura blobs */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-400/15 blur-[80px] animate-tcg-float glow-soft-mask" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-primary-400/15 blur-[80px] animate-tcg-float-slow glow-soft-mask" />

        {/* rarity ribbon */}
        {product?.rarity && (
          <div className="absolute top-4 left-4 z-20">
            <RarityBadge rarity={product.rarity} size="lg" />
          </div>
        )}

        {/* Multi-image counter / navigation pill (top-right) */}
        {images.length > 1 && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 rounded-full glass-panel px-2 py-1 text-xs font-semibold shadow-sm">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous image"
              className="p-1 rounded-full text-muted hover:text-strong hover:bg-white/20 transition"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-1 text-[11px] font-bold text-ink-700 dark:text-ink-200">
              {selectedIndex + 1} / {images.length}
            </span>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next image"
              className="p-1 rounded-full text-muted hover:text-strong hover:bg-white/20 transition"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
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
                alt={`${product?.name || 'Product'} — view ${selectedIndex + 1}`}
                sealed={sealed}
                icon={sealed ? Package : undefined}
                className="h-full w-full object-contain pd-artwork"
                fallbackClassName="pd-fallback"
                iconClassName={sealed ? 'h-12 w-12 text-slate-400 dark:text-white/70' : 'h-12 w-12 text-white/90'}
                label={activeLabel}
              />
            </TiltCard>
          </div>
        </div>
      </div>

      {/* ── Thumbnail preview row / carousel below the main image ────── */}
      {images.length > 1 && (
        <div
          data-testid="product-gallery-thumbnails"
          className="mt-4 flex items-center justify-center gap-3 overflow-x-auto py-2 px-1 scrollbar-thin"
        >
          {images.map((src, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                aria-pressed={isSelected}
                aria-label={`View image ${idx + 1}`}
                data-testid={`gallery-thumb-${idx}`}
                className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
                  isSelected
                    ? 'ring-2 ring-pink-500 shadow-sm -translate-y-0.5 scale-105'
                    : 'border border-neutral-200 dark:border-neutral-800 opacity-70 hover:opacity-100 transition-opacity'
                } ${isCard ? 'aspect-[5/7] w-16 sm:w-20' : 'aspect-[4/3] w-20 sm:w-24'} shrink-0 bg-gray-100 dark:bg-gray-800`}
              >
                {src ? (
                  <img src={src} alt="" loading="lazy" className="h-full w-full object-cover rounded-lg" />
                ) : (
                  <div className="img-fallback-holo h-full w-full rounded-lg" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductGallery;
