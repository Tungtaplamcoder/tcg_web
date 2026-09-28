import React, { useEffect, useRef, useState } from 'react';
import { Package, Sparkles } from 'lucide-react';

/**
 * ProductImage — resilient product artwork.
 * Shows a shimmering skeleton while loading, and falls back to a placeholder
 * whenever the src is missing or fails to load (broken URL, 404, etc.).
 *
 * The fallback is type-aware: single cards keep the holographic card-back
 * motif, while sealed products (`sealed`) get a neutral box placeholder so a
 * sealed booster box/pack can NEVER render with a Pokémon card-back.
 *
 * `className` is applied to the <img> only.
 * `fallbackClassName` sizes the placeholder (defaults to filling the
 * nearest positioned/flex parent).
 */
const ProductImage = ({
  src,
  alt = '',
  className = '',
  fallbackClassName = 'h-full w-full',
  skeletonClassName = '',
  icon: Icon = Sparkles,
  iconClassName = 'h-10 w-10 text-white/90',
  label = null,
  sealed = false,
  ...rest
}) => {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);
  const hasSrc = typeof src === 'string' && src.trim() !== '';

  /* Reset state when the source changes */
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  /* Handle cached images where onLoad never fires after mount */
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, [src, failed]);

  if (!hasSrc || failed) {
    /* Sealed products must never fall back to the card-back motif — use a
     * neutral box placeholder instead. Single cards keep the holo card-back. */
    const FallbackIcon = sealed ? Package : Icon;
    return (
      <div
        role="img"
        aria-label={alt || (sealed ? 'Sealed product image unavailable' : 'Product image unavailable')}
        className={`${sealed ? 'img-fallback-box' : 'img-fallback-holo'} flex flex-col items-center justify-center gap-2 rounded-xl ${fallbackClassName}`}
      >
        <FallbackIcon className={`${iconClassName} drop-shadow`} aria-hidden="true" />
        <span className={`max-w-full truncate px-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] ${sealed ? 'text-slate-500 dark:text-white/70' : 'text-white/85'}`}>
          {label || (sealed ? 'Sealed Product' : 'Holo Preview')}
        </span>
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div
          aria-hidden="true"
          className={`${sealed ? 'img-fallback-box' : 'img-fallback-holo'} absolute inset-0 overflow-hidden ${skeletonClassName}`}
        >
          <div className="animate-shine absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent" />
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        {...rest}
      />
    </>
  );
};

export default ProductImage;
