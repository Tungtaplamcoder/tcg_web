import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, ArrowLeft, Loader2, Minus, Plus, Check, Zap, Package, Star,
  MessageCircle, Phone, Mail, X
} from 'lucide-react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useShop } from '../context/ShopContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatVND, formatPrice, USD_TO_VND_RATE } from '../utils/format';
import { playTick, vibrate } from '../utils/sfx';
import BreadcrumbBar from '../components/BreadcrumbBar';
import ProductGallery from '../components/ProductGallery';
import TrustBadges from '../components/TrustBadges';
import { parseProductData, repairProductEncoding } from '../utils/productDataParser';
import { getProductCategory } from '../constants/productCategories';

const RANGE_KEYS = {
  month: 'product.range.month',
  quarter: 'product.range.quarter',
  'semi-annual': 'product.range.semi-annual',
  annual: 'product.range.annual'
};

const CONDITION_KEYS = ['MINT', 'NEAR_MINT', 'LIGHTLY_PLAYED', 'MODERATELY_PLAYED', 'HEAVILY_PLAYED'];

const VARIANT_KEYS = ['NORMAL', 'HOLOFOIL', 'REVERSE_HOLOFOIL', '1ST_EDITION', '1ST_EDITION_HOLOFOIL', 'UNLIMITED_HOLOFOIL'];

/**
 * Safe condition label resolver.
 *
 * The condition catalogue became dynamic ("Tình trạng thẻ"), so a variant can
 * hold a free-text value (e.g. "PSA 10", "abc") that has NO matching
 * `product.condition.*` i18n key. The lightweight i18n helper returns the raw
 * key when a translation is missing, which leaked strings like
 * "product.condition.PSA 10" onto the page. When the resolved string still
 * contains the key prefix, render the raw dynamic condition text directly.
 */
const formatConditionLabel = (condition, t) => {
  if (!condition) return t('product.condition.NEAR_MINT');
  const key = `product.condition.${condition}`;
  const translated = t(key);
  if (typeof translated === 'string' && !translated.includes('product.condition.')) {
    return translated;
  }
  return String(condition);
};
const formatVariant = (v, t) => {
  if (!v || v === '') return t('product.variantType.NORMAL');
  const key = `product.variantType.${v}`;
  const translated = t(key);
  return translated !== key ? translated : v.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
};

const CHART_THEMES = {
  light: {
    grid: '#e2e8f0', text: '#94a3b8', axis: '#cbd5e1',
    bar: 'rgba(147, 51, 234, 0.25)', barRing: 'rgba(196,181,253,0.6)', cursor: '#c4b5fd'
  },
  dark: {
    grid: 'rgba(255,255,255,0.08)', text: '#7c83a3', axis: 'rgba(255,255,255,0.14)',
    bar: 'rgba(139,92,246,0.25)', barRing: 'rgba(139,92,246,0.45)', cursor: 'rgba(139,92,246,0.55)'
  }
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [priceRange, setPriceRange] = useState('semi-annual');
  const [priceData, setPriceData] = useState(null);
  const [isLoadingRange, setIsLoadingRange] = useState(false);
  const [added, setAdded] = useState(false);
  const [toast, setToast] = useState(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const cacheRef = useRef(new Map());
  const addedTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const { shop } = useShop();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const chartTheme = CHART_THEMES[theme] || CHART_THEMES.light;

  /* ── Automatic Data Parser: one memoized pass for the whole page ── */
  const parsed = useMemo(() => (product ? parseProductData(product) : null), [product]);
  const productType = parsed?.productType;

  /* Sealed products vs single cards. `parseProductType` already resolves the
   * canonical category slugs (`sealed-products` / `single-cards`) and
   * `attributes.type`, but honor an explicit `main_type` field when the API
   * sends one so the SOURCE OF TRUTH always wins. Card-only attributes
   * (condition, finish, front/back flip) are gated strictly on SINGLE_CARD. */
  const mainType = String(product?.main_type ?? product?.mainType ?? '').trim().toUpperCase();
  const isSealedProduct = mainType === 'SEALED_PRODUCT' || (mainType !== 'SINGLE_CARD' && productType === 'BOX');
  const isSingleCard = !isSealedProduct;
  const isBox = isSealedProduct;
  const categoryMeta = useMemo(() => getProductCategory(product), [product]);

  /* ── Breadcrumb trail: Home > Catalog > [Category >] Product ──
     MUST live above the early returns — conditional hook order is the
     classic "white screen after data loads" crash (React throws
     "Rendered more hooks than during the previous render"). */
  const breadcrumbItems = useMemo(() => {
    if (!product) return [];
    const items = [{ label: t('nav.catalog'), to: '/catalog' }];
    if (categoryMeta) {
      items.push({ label: categoryMeta.description || categoryMeta.label, to: `/catalog?category=${categoryMeta.slug || (categoryMeta.value === 'BOX' ? 'sealed-products' : 'single-cards')}` });
    }
    items.push({ label: product.shortName || product.name });
    return items;
  }, [product, categoryMeta, t]);

  const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
    return formatVND(Number(value) * USD_TO_VND_RATE);
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined || isNaN(Number(value))) return 'N/A';
    return Number(value).toLocaleString('vi-VN');
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatFullDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      setError('');
      setProduct(null);
      try {
        const response = await api.get(`/products/${id}`);
        const data = response?.data?.data;

        // ── Payload validation: never render a malformed record ──
        if (!data || typeof data !== 'object' || !data.id) {
          console.error('[ProductDetail] API returned invalid product payload:', response?.data);
          setError(t('product.errors.notFound'));
          return;
        }

        // Normalize optional fields so downstream rendering is crash-proof
        const safeData = repairProductEncoding({
          ...data,
          name: data.name || 'Unnamed Product',
          images: Array.isArray(data.images) ? data.images : [],
          variants: Array.isArray(data.variants) ? data.variants : [],
          sets: Array.isArray(data.sets) ? data.sets : [],
          attributes:
            data.attributes && typeof data.attributes === 'object' && !Array.isArray(data.attributes)
              ? data.attributes
              : {}
        });

        setProduct(safeData);
        const available = safeData.variants.find(v => v?.stockQuantity > 0) || safeData.variants[0];
        if (available) setSelectedVariantId(available.id);
      } catch (err) {
        // Distinguish 404 (missing product) from network/server errors
        const status = err?.response?.status;
        if (status === 404) {
          console.error(`[ProductDetail] Product ${id} not found (404):`, err?.response?.data);
          setError(t('product.errors.removed'));
        } else if (!err?.response) {
          console.error('[ProductDetail] Network error while loading product:', err);
          setError(t('product.errors.network'));
        } else {
          console.error(`[ProductDetail] Failed to load product (HTTP ${status}):`, err?.response?.data || err);
          setError(t('product.errors.loadFailed'));
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const selectedVariant = product?.variants?.find(v => v.id === selectedVariantId) || product?.variants?.[0] || null;
  const currentPrice = selectedVariant ? Number(selectedVariant.price) : Number(product?.price || product?.minPrice || 0);
  const isZeroPrice = !currentPrice || currentPrice <= 0;

  const loadPriceData = useCallback(async (range) => {
    if (!product?.tcgplayerId) return;

    const condition = selectedVariant?.condition || 'NEAR_MINT';
    const variant = selectedVariant?.variant || '';

    const cacheKey = `${range}_${condition}_${variant}`;
    if (cacheRef.current.has(cacheKey)) {
      setPriceData(cacheRef.current.get(cacheKey));
      return;
    }

    setIsLoadingRange(true);
    try {
      const response = await api.get(`/tcgplayer/price-history/${product.tcgplayerId}`, {
        params: { range, condition, variant }
      });
      const data = response?.data?.data || {};
      const normalizedData = {
        chart_data: Array.isArray(data.chart_data) ? data.chart_data : [],
        price_metrics: (data.price_metrics && typeof data.price_metrics === 'object')
          ? data.price_metrics
          : { comparison_prices: [], price_points: null, snapshot: null }
      };
      if (normalizedData.price_metrics.comparison_prices == null) {
        normalizedData.price_metrics.comparison_prices = [];
      }
      cacheRef.current.set(cacheKey, normalizedData);
      setPriceData(normalizedData);
    } catch (err) {
      console.error('Failed to load price history:', err);
      setPriceData({ chart_data: [], price_metrics: { comparison_prices: [], price_points: null, snapshot: null } });
    } finally {
      setIsLoadingRange(false);
    }
  }, [product?.tcgplayerId, selectedVariant]);

  useEffect(() => {
    if (product?.tcgplayerId) {
      loadPriceData(priceRange);
    }
  }, [product?.tcgplayerId, priceRange, selectedVariant, loadPriceData]);

  useEffect(() => () => {
    window.clearTimeout(addedTimerRef.current);
    window.clearTimeout(toastTimerRef.current);
  }, []);

  /* ── "Thêm vào giỏ": cart-state update + success toast ONLY ──
     Stays on the current product page. No navigate('/cart'), no redirect
     for guests either — the cart is a local, persistent store. */
  const handleAddToCart = () => {
    if (isZeroPrice || Number(selectedVariant?.price) <= 0) {
      setIsContactModalOpen(true);
      return;
    }
    if (!selectedVariantId || !selectedVariant?.stockQuantity) return;

    addItem({
      id: product.id,
      name: product.name,
      price: Number(selectedVariant.price),
      images: product.images || [],
      stockQuantity: selectedVariant.stockQuantity
    }, quantity, selectedVariant.id);
    playTick();
    vibrate([12]);
    setAdded(true);
    setToast({ message: t('product.addToCartSuccess'), type: 'success' });

    window.clearTimeout(addedTimerRef.current);
    window.clearTimeout(toastTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => setAdded(false), 2200);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  };

  const handleBuyNow = () => {
    if (isZeroPrice || Number(selectedVariant?.price) <= 0) {
      setIsContactModalOpen(true);
      return;
    }
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/product/${id}` } });
      return;
    }
    if (!selectedVariantId || !selectedVariant?.stockQuantity) return;

    addItem({
      id: product.id,
      name: product.name,
      price: Number(selectedVariant.price),
      images: product.images || [],
      stockQuantity: selectedVariant.stockQuantity
    }, quantity, selectedVariant.id);
    playTick();
    vibrate([12]);
    navigate('/checkout');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse">
          <div className="h-[420px] rounded-3xl surface" />
          <div className="space-y-4 py-4">
            <div className="h-9 bg-ink-100 dark:bg-white/5 rounded-xl w-3/4" />
            <div className="h-5 bg-ink-100 dark:bg-white/5 rounded-lg w-1/3" />
            <div className="h-10 bg-ink-100 dark:bg-white/5 rounded-xl w-1/2" />
            <div className="h-32 bg-ink-100 dark:bg-white/5 rounded-2xl" />
            <div className="h-12 bg-ink-100 dark:bg-white/5 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-rose-500 font-medium">{error || t('product.errors.notFound')}</p>
        <button onClick={() => navigate('/catalog')} className="btn-ghost mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> {t('product.errors.backToCatalog')}
        </button>
      </div>
    );
  }

  const chartData = (Array.isArray(priceData?.chart_data) ? priceData.chart_data : [])
    .filter((item) => item && typeof item === 'object');
  const metrics = (priceData?.price_metrics && typeof priceData.price_metrics === 'object')
    ? priceData.price_metrics
    : null;

  const chartDataMapped = chartData.map(item => ({
    date: item.date || '',
    endDate: item.endDate || item.date || '',
    dateLabel: item.dateLabel || item.date || '',
    marketPrice: Number(item.price) || 0,
    quantitySold: parseInt(item.quantitySold, 10) || 0,
    lowPrice: item.lowPrice !== null ? Number(item.lowPrice) : null,
    highPrice: item.highPrice !== null ? Number(item.highPrice) : null
  }));

  // 5 evenly-distributed date ticks so X labels stay stable regardless of data density
  const evenDateTicks = (() => {
    const targetCount = 5;
    if (chartDataMapped.length <= targetCount) return chartDataMapped.map(d => d.date);
    const picked = [];
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.round((i * (chartDataMapped.length - 1)) / (targetCount - 1));
      if (!picked.includes(chartDataMapped[idx].date)) picked.push(chartDataMapped[idx].date);
    }
    return picked;
  })();

  // Right axis: volume scale derives from the active filtered dataset so bars
  // always fill the plot area across every timeframe. Math.max() with an empty
  // spread returns -Infinity — guard with a 0 floor. 1.2 headroom keeps the
  // tallest bar from touching the top; rounded tick steps keep labels clean.
  const maxVolume = chartDataMapped.length > 0
    ? Math.max(...chartDataMapped.map(d => d.quantitySold), 0)
    : 0;
  const rawTop = Math.max(maxVolume * 1.2, 10);
  const volumeStep = Math.pow(10, Math.floor(Math.log10(rawTop))) / 2;
  const volumeTop = Math.ceil(rawTop / volumeStep) * volumeStep;
  const volumeTicks = Array.from({ length: Math.round(volumeTop / volumeStep) + 1 }, (_, i) =>
    Math.round(i * volumeStep * 100) / 100
  );

  const snapshotTitle = (RANGE_KEYS[priceRange] && t(RANGE_KEYS[priceRange])) || 'Snapshot';

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload;
    return (
      <div className="glass-panel-strong text-strong rounded-xl shadow-2xl shadow-ink-900/15 border border-subtle p-3.5" style={{ minWidth: '200px' }}>
        <div className="text-ink-400 dark:text-ink-300 text-xs font-semibold border-b border-ink-100 dark:border-white/10 pb-1.5 mb-2">
          {data.dateLabel || formatFullDate(data.date)}
        </div>
        <div className="text-gradient-brand font-bold text-lg">
          {formatVND(data.marketPrice * USD_TO_VND_RATE)}
        </div>
        <div className="text-ink-500 dark:text-ink-300 text-sm">
          {data.quantitySold} {t('product.itemsSold')}
        </div>
        {(data.lowPrice !== null || data.highPrice !== null) && (
          <div className="text-ink-500 dark:text-ink-300 text-sm">
            {data.lowPrice !== null ? formatVND(data.lowPrice * USD_TO_VND_RATE) : '—'} - {data.highPrice !== null ? formatVND(data.highPrice * USD_TO_VND_RATE) : '—'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen animate-tcg-reveal">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <BreadcrumbBar items={breadcrumbItems} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* ── Image container & 3D interactive view ─────────────── */}
        <ProductGallery product={product} isSealedProduct={isSealedProduct} />

        {/* ── Details ───────────────────────────────────────────── */}
        <div>
          {/* Product type eyebrow */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
              isBox
                ? 'bg-pink-500/10 text-pink-500 dark:text-pink-400 ring-1 ring-pink-400/30'
                : 'bg-primary-400/15 text-primary-700 dark:text-primary-300 ring-1 ring-primary-400/30'
            }`}>
              {isBox ? <Package className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
              {isBox ? t('product.sealedBox') : t('product.singleCard')}
            </span>
            {parsed?.franchise?.label && (
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-faint">
                {parsed.franchise.label}
              </span>
            )}
          </div>

          <h1 className="heading-display text-3xl sm:text-4xl leading-tight">{product.name}</h1>
          {product.sets && product.sets.length > 0 && (
            <p className="text-ink-500 dark:text-ink-300 mt-2 font-medium">{product.sets.map(s => s?.name).filter(Boolean).join(', ')}</p>
          )}

          <div className="mt-4 flex items-center gap-2.5">
            <div className="flex text-pink-500">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-[18px] w-[18px] fill-pink-500" />)}
            </div>
            <span className="text-sm text-ink-400 dark:text-ink-300">({t('product.reviews', { count: 0 })})</span>
          </div>

          {/* Price + live inventory badge */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="pd-price-chip" data-testid="product-detail-price">
              {isZeroPrice ? (
                <span className="text-3xl sm:text-4xl font-display font-semibold text-pink-500 dark:text-pink-400">
                  Liên hệ
                </span>
              ) : (
                <span className="text-3xl sm:text-4xl font-display font-bold text-gradient-brand">
                  {selectedVariant ? formatPrice(selectedVariant.price) : t('product.selectCondition')}
                </span>
              )}
            </div>
            {selectedVariant && (
              <span className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider ${
                selectedVariant.stockQuantity > 0
                  ? 'bg-emerald-400/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400/30'
                  : 'bg-rose-400/15 text-rose-600 dark:text-rose-300 ring-1 ring-rose-400/30'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${selectedVariant.stockQuantity > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {selectedVariant.stockQuantity > 0 ? t('product.inStockBadge') : t('product.soldOut')}
              </span>
            )}
          </div>

          {/* Condition / finish variants — SINGLE CARDS ONLY.
              Sealed products must never surface card attributes (condition
              like "Near Mint", finish like "Normal"/"Foil"/"Reverse Foil").
              Their variants carry only price + stock, so we render a plain
              price/stock list instead. */}
          {isSingleCard && product.variants && product.variants.length > 0 && (
            <div className="mt-6">
              <label className="label-premium">{t('product.conditionCardType')}</label>
              <div className="flex flex-wrap gap-2.5">
                {product.variants.map(v => {
                  const isSelected = selectedVariantId === v.id;
                  const inStock = v.stockQuantity > 0;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      disabled={!inStock}
                      className={`group inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                        isSelected
                          ? 'text-white bg-gradient-to-r from-primary-600 to-fuchsia-600 shadow-[0_6px_20px_-6px_rgba(124,58,237,0.55)] ring-1 ring-white/25'
                          : 'glass-panel text-strong ring-1 ring-transparent hover:ring-primary-400/50 hover:-translate-y-0.5'
                      } disabled:opacity-45 disabled:pointer-events-none`}
                    >
                      {formatConditionLabel(v.condition, t)} <span className={isSelected ? 'text-white/70' : 'text-faint'}>•</span> {formatVariant(v.variant, t)}
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                        inStock
                          ? 'bg-emerald-400/15 text-emerald-600 dark:text-emerald-300'
                          : 'bg-rose-400/15 text-rose-500'
                      } ${isSelected ? 'bg-white/20 text-white' : ''}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${inStock ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {inStock ? t('product.available', { count: v.stockQuantity }) : t('product.soldOut')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isSealedProduct && product.variants && product.variants.length > 0 && (
            <div className="mt-6">
              <label className="label-premium">{t('product.availableStock')}</label>
              <div className="flex flex-wrap gap-2.5">
                {product.variants.map(v => {
                  const isSelected = selectedVariantId === v.id;
                  const inStock = v.stockQuantity > 0;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      disabled={!inStock}
                      className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                        isSelected
                          ? 'text-white bg-gradient-to-r from-primary-600 to-fuchsia-600 shadow-[0_6px_20px_-6px_rgba(124,58,237,0.55)] ring-1 ring-white/25'
                          : 'glass-panel text-strong ring-1 ring-transparent hover:ring-primary-400/50 hover:-translate-y-0.5'
                      } disabled:opacity-45 disabled:pointer-events-none`}
                    >
                      {formatPrice(Number(v.price))}
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                        inStock
                          ? 'bg-emerald-400/15 text-emerald-600 dark:text-emerald-300'
                          : 'bg-rose-400/15 text-rose-500'
                      } ${isSelected ? 'bg-white/20 text-white' : ''}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${inStock ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {inStock ? t('product.available', { count: v.stockQuantity }) : t('product.soldOut')}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Action area: quantity + CTA OR Zero-Price Contact Consultation Button ── */}
          {isZeroPrice ? (
            <div className="mt-7 space-y-3" data-testid="zero-price-contact-container">
              <button
                type="button"
                onClick={() => setIsContactModalOpen(true)}
                data-testid="contact-consult-btn"
                className="btn-primary w-full !py-3.5 text-base flex items-center justify-center gap-2.5 shadow-soft-lg hover:shadow-soft transition-all"
              >
                <MessageCircle className="h-5 w-5" />
                <span>Liên hệ tư vấn</span>
              </button>
              <div className="p-3.5 rounded-2xl border border-pink-100/70 dark:border-pink-900/30 bg-pink-50/50 dark:bg-pink-950/20 text-xs text-ink-600 dark:text-neutral-300 flex items-center gap-2.5">
                <Package className="h-4 w-4 text-pink-500 shrink-0" />
                <span>Sản phẩm đặc biệt / liên hệ — vui lòng liên hệ tư vấn để nhận báo giá và ưu đãi trực tiếp.</span>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-7 flex items-stretch gap-3">
                <div className="inline-flex items-center self-stretch rounded-xl border border-subtle surface overflow-hidden shrink-0">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-3 text-ink-500 dark:text-ink-300 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-400/10 transition-colors"
                    aria-label={t('cart.decreaseQty')}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="px-5 py-3 font-bold text-ink-900 dark:text-white min-w-[3rem] text-center tabular-nums">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(selectedVariant?.stockQuantity || 10, quantity + 1))}
                    className="p-3 text-ink-500 dark:text-ink-300 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-400/10 transition-colors"
                    aria-label={t('cart.increaseQty')}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={!selectedVariantId || !selectedVariant?.stockQuantity || added}
                  className={`btn-primary flex-1 w-full !py-3.5 text-base ${added ? '!from-emerald-500 !to-teal-500' : ''}`}
                >
                  {added ? (<><Check className="h-5 w-5" /> {t('product.added')}</>) : (<><ShoppingCart className="h-5 w-5" /> {t('product.addToCart')}</>)}
                </button>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={!selectedVariantId || !selectedVariant?.stockQuantity}
                  className="btn-aura w-full !py-3.5 text-base"
                >
                  <Zap className="h-5 w-5" /> {t('product.buyNow')}
                </button>
              </div>
            </>
          )}

          {/* ── Trust badges ────────────────────────────────────── */}
          <div className="mt-6">
            <TrustBadges />
          </div>
        </div>
      </div>

      {/* ── Specifications / Product Details: full-width info section ── */}
      {product.description && (
        <section className="mt-10 w-full" data-testid="product-description-section">
          <p className="section-eyebrow">{t('product.specifications')}</p>
          <h2 className="heading-display text-xl sm:text-2xl mt-1 mb-4">
            {isBox ? t('product.boxDetailsTitle') : t('product.cardDetailsTitle')}
          </h2>
          <div className="w-full bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
            <p className="whitespace-pre-line leading-relaxed">
              {product.description}
            </p>
          </div>
        </section>
      )}

      {/* ==================== MARKET PRICE TRENDS ==================== */}
      {product.tcgplayerId && (
        <div className="relative mt-12 overflow-hidden rounded-3xl glass-panel p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-24 right-1/4 h-64 w-64 rounded-full bg-fuchsia-400/10 blur-[90px]" />
          <div className="mb-6">
            <p className="section-eyebrow">{t('product.marketInsights')}</p>
            <h2 className="heading-display text-2xl mt-1">{t('product.marketPriceTrends')}</h2>
          </div>

          {priceData === null && !isLoadingRange ? (
            <p className="text-ink-400 dark:text-ink-300">{t('product.noPriceHistory')}</p>
          ) : (
            <div className="relative">
              {isLoadingRange && (
                <div className="absolute inset-0 bg-white/60 dark:bg-ink-950/90 md:dark:bg-ink-950/60 backdrop-blur-sm z-20 flex items-center justify-center rounded-2xl">
                  <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left column: Chart */}
                <div className="rounded-2xl surface-2 p-4 sm:p-5">
                  {chartDataMapped.length > 0 && (
                    <div style={{ width: '100%', height: 320 }}>
                      <ResponsiveContainer>
                        <ComposedChart data={chartDataMapped} margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
                          <defs>
                            <linearGradient id="brandLine" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#7c3aed" />
                              <stop offset="100%" stopColor="#d946ef" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                          <XAxis
                            dataKey="date"
                            ticks={evenDateTicks}
                            tickFormatter={formatDateShort}
                            tick={{ fontSize: 12, fill: chartTheme.text }}
                            axisLine={{ stroke: chartTheme.axis }}
                            tickLine={false}
                          />
                          <YAxis
                            yAxisId="left"
                            tickFormatter={(value) => formatVND(value * USD_TO_VND_RATE)}
                            tick={{ fontSize: 12, fill: chartTheme.text }}
                            axisLine={false}
                            tickLine={false}
                            width={100}
                            domain={[dataMin => Math.floor(dataMin * 0.9), dataMax => Math.ceil(dataMax * 1.1)]}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            domain={[0, volumeTop]}
                            ticks={volumeTicks}
                            tick={{ fontSize: 12, fill: chartTheme.text }}
                            axisLine={false}
                            tickLine={false}
                            width={60}
                          />
                          <Tooltip content={<CustomTooltip />} cursor={{ stroke: chartTheme.cursor, strokeDasharray: '4 4' }} />
                          <Bar
                            yAxisId="right"
                            dataKey="quantitySold"
                            fill={chartTheme.bar}
                            barCategoryGap="2%"
                            maxBarSize={20}
                            radius={[4, 4, 0, 0]}
                          />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="marketPrice"
                            stroke="url(#brandLine)"
                            strokeWidth={2.5}
                            dot={false}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            connectNulls
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Time range tabs */}
                  <div className="flex justify-center mt-5 gap-1.5 rounded-full bg-ink-50 dark:bg-white/5 ring-1 ring-ink-100 dark:ring-white/10 p-1.5 w-fit mx-auto">
                    {[
                      { key: 'month', label: '1M' },
                      { key: 'quarter', label: '3M' },
                      { key: 'semi-annual', label: '6M' },
                      { key: 'annual', label: '1Y' }
                    ].map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setPriceRange(tab.key)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-300 ${
                          priceRange === tab.key
                            ? 'bg-gradient-to-r from-primary-600 to-fuchsia-600 text-white shadow-[0_4px_12px_-4px_rgba(124,58,237,0.5)]'
                            : 'text-ink-500 dark:text-ink-300 hover:text-ink-800 dark:hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="mt-4 flex items-center justify-center flex-wrap gap-x-6 gap-y-2 text-xs text-ink-500 dark:text-ink-300">
                    <div className="flex items-center">
                        <span className="w-3 h-3 rounded-sm bg-primary-400/25 dark:bg-primary-500/30 ring-1 ring-primary-200 dark:ring-primary-400/30 mr-1.5"></span>
                        {t('product.itemsSold')}
                      </div>
                      <div className="flex items-center">
                        <span className="w-3 h-3 rounded-full bg-gradient-to-r from-primary-600 to-primary-400 mr-1.5"></span>
                        {t('product.legendMarketPrice')}
                      </div>
                  </div>
                </div>

                {/* Right column: Stats */}
                <div className="space-y-4">
                  <div className="rounded-2xl bg-gradient-to-br from-primary-50/80 to-fuchsia-50/60 ring-1 ring-primary-200/50 p-5 dark:from-white/5 dark:to-aura-violet/10 dark:ring-white/10">
                    <h3 className="font-display font-bold text-ink-900 dark:text-white">{t('product.priceMarketStats')}</h3>
                    <div className="mt-4 space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-ink-500 dark:text-ink-300">{t('product.marketPriceLabel')}</span>
                        <span className="text-xl font-bold text-gradient-brand">
                          {metrics?.price_points ? formatCurrency(metrics.price_points.marketPrice) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-ink-500 dark:text-ink-300">{t('product.mostRecentSale')}</span>
                        <span className="text-sm font-semibold text-ink-700 dark:text-ink-100">
                          {metrics?.price_points ? formatCurrency(metrics.price_points.mostRecentSale) : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-ink-500 dark:text-ink-300">
                          {metrics?.price_points?.volatility || 'Med Volatility'}
                        </span>
                        <div className="w-full h-1.5 bg-white/80 dark:bg-[#1c1216]/80 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-pink-400 to-rose-500" style={{ width: '50%' }} />
                        </div>
                      </div>
                    </div>

                    {(Array.isArray(metrics?.comparison_prices) ? metrics.comparison_prices : []).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-primary-200/40">
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2.5">{t('product.nearMintComparison')}</p>
                        <div className="flex flex-wrap gap-2">
                          {metrics.comparison_prices.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white/85 dark:bg-white/10 rounded-lg px-3 py-1.5 ring-1 ring-primary-200/50 dark:ring-white/10 shadow-sm">
                              <span className="text-sm text-ink-500 dark:text-ink-300">{item?.label ?? 'Price'}:</span>
                              <span className="font-bold text-ink-800 dark:text-white">{formatCurrency(item?.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl surface p-5">
                    <h3 className="font-display font-bold text-ink-900 dark:text-white">{snapshotTitle}</h3>
                    {metrics?.snapshot && typeof metrics.snapshot === 'object' ? (
                      <div className="grid grid-cols-2 gap-2.5 mt-4">
                        <div className="rounded-xl surface-2 p-3 text-center">
                          <p className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300 font-semibold">{t('product.snapshot.lowSalePrice')}</p>
                          <p className="font-bold text-ink-800 dark:text-white mt-1">{formatCurrency(metrics.snapshot.lowSalePrice)}</p>
                        </div>
                        <div className="rounded-xl surface-2 p-3 text-center">
                          <p className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300 font-semibold">{t('product.snapshot.highSalePrice')}</p>
                          <p className="font-bold text-ink-800 dark:text-white mt-1">{formatCurrency(metrics.snapshot.highSalePrice)}</p>
                        </div>
                        <div className="rounded-xl surface-2 p-3 text-center">
                          <p className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300 font-semibold">{t('product.snapshot.totalSold')}</p>
                          <p className="font-bold text-ink-800 dark:text-white mt-1">{formatNumber(metrics.snapshot.totalSold)}</p>
                        </div>
                        <div className="rounded-xl surface-2 p-3 text-center">
                          <p className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300 font-semibold">{t('product.snapshot.avgDailySold')}</p>
                          <p className="font-bold text-ink-800 dark:text-white mt-1">{formatNumber(metrics.snapshot.avgDailySold)}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-ink-400 dark:text-ink-300 mt-2">N/A</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      </div>

      {/* ── Contact Consultation Modal (Zero-Price Products) ── */}
      {isContactModalOpen && (
        <div
          data-testid="contact-consultation-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-tcg-reveal"
        >
          <div
            className="relative w-full max-w-md rounded-3xl bg-white dark:bg-[#1a1219] p-6 sm:p-7 shadow-2xl border border-pink-100 dark:border-pink-900/40 text-left overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-pink-100 dark:border-pink-900/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-pink-500/10 dark:bg-pink-400/15 flex items-center justify-center text-pink-500 dark:text-pink-400">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold font-display text-ink-900 dark:text-white">
                    Liên hệ tư vấn
                  </h3>
                  <p className="text-xs text-ink-500 dark:text-neutral-400">
                    Báo giá & thông tin tình trạng thẻ
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="close-contact-modal-btn"
                onClick={() => setIsContactModalOpen(false)}
                className="p-2 rounded-xl text-ink-400 hover:text-ink-700 dark:hover:text-white hover:bg-pink-50 dark:hover:bg-white/5 transition-colors"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Product Summary */}
            <div className="mt-4 p-3.5 rounded-2xl bg-pink-50/50 dark:bg-pink-950/20 border border-pink-100/70 dark:border-pink-900/30">
              <p className="text-xs font-semibold uppercase tracking-wider text-pink-600 dark:text-pink-400">
                Sản phẩm quan tâm
              </p>
              <p className="text-sm font-bold text-ink-900 dark:text-white line-clamp-2 mt-0.5">
                {product?.name}
              </p>
              <div className="mt-2 flex items-center justify-between pt-2 border-t border-pink-100/50 dark:border-pink-900/20">
                <span className="text-xs text-ink-500 dark:text-neutral-400">Mức giá:</span>
                <span className="font-semibold text-pink-500 dark:text-pink-400 text-sm">Liên hệ</span>
              </div>
            </div>

            {/* Channels */}
            <div className="mt-5 space-y-3">
              <p className="text-xs text-ink-500 dark:text-neutral-400 leading-relaxed">
                Sản phẩm này có giá trị biến động theo thị trường hoặc số lượng giới hạn. Vui lòng liên hệ trực tiếp với chúng tôi qua các kênh sau để nhận báo giá ưu đãi:
              </p>

              <a
                href={`tel:${shop?.support_phone || '0987654321'}`}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50 dark:bg-white/5 hover:bg-pink-50 dark:hover:bg-pink-950/30 border border-neutral-200/70 dark:border-white/10 hover:border-pink-300 dark:hover:border-pink-800 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-pink-100/60 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300 flex items-center justify-center">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[11px] block text-ink-400 dark:text-neutral-400 font-medium">Hotline / Zalo tư vấn</span>
                    <span className="text-sm font-bold text-ink-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                      {shop?.support_phone || '0987 654 321'}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-pink-600 dark:text-pink-400">Gọi ngay →</span>
              </a>

              <a
                href={`mailto:${shop?.support_email || 'support@tcgstore.com'}?subject=Tư vấn báo giá sản phẩm: ${encodeURIComponent(product?.name || '')}`}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-50 dark:bg-white/5 hover:bg-pink-50 dark:hover:bg-pink-950/30 border border-neutral-200/70 dark:border-white/10 hover:border-pink-300 dark:hover:border-pink-800 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-pink-100/60 dark:bg-pink-900/40 text-pink-600 dark:text-pink-300 flex items-center justify-center">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-[11px] block text-ink-400 dark:text-neutral-400 font-medium">Email hỗ trợ</span>
                    <span className="text-sm font-bold text-ink-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
                      {shop?.support_email || 'support@tcgstore.com'}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-pink-600 dark:text-pink-400">Gửi mail →</span>
              </a>
            </div>

            {/* Footer action */}
            <div className="mt-6 pt-4 border-t border-pink-100 dark:border-pink-900/30 flex justify-end">
              <button
                type="button"
                onClick={() => setIsContactModalOpen(false)}
                className="w-full py-2.5 rounded-xl font-semibold text-sm bg-neutral-100 dark:bg-white/10 text-ink-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-white/15 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add-to-cart success toast (no navigation) ─────────── */}
      {toast && (
        <div
          data-testid="cart-toast"
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[80] flex items-center gap-3 rounded-2xl bg-emerald-600 text-white px-4 py-3 shadow-2xl shadow-emerald-900/25 ring-1 ring-white/20 animate-tcg-reveal"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
            <Check className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
