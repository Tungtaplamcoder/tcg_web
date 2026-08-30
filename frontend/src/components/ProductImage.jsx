import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * ProductImage — resilient product artwork.
 * Shows a shimmering skeleton while loading, and falls back to a stylized
 * holographic card/box graphic whenever the src is missing or fails to
 * load (broken URL, 404, etc.). Safe drop-in for a plain <img>.
 *
 * `className` is applied to the <img> only.
 * `fallbackClassName` sizes the holographic fallback (defaults to filling
 * the nearest positioned/flex parent).
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
    return (
      <div
        role="img"
        aria-label={alt || 'Product image unavailable'}
        className={`img-fallback-holo flex flex-col items-center justify-center gap-2 rounded-xl ${fallbackClassName}`}
      >
        <Icon className={`${iconClassName} drop-shadow`} aria-hidden="true" />
        <span className="max-w-full truncate px-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/85">
          {label || 'Holo Preview'}
        </span>
      </div>
    );
  }

  return (
    <>
      {!loaded && (
        <div
          aria-hidden="true"
          className={`img-fallback-holo absolute inset-0 overflow-hidden ${skeletonClassName}`}
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
