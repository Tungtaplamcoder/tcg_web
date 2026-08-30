import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, Star, Shield, Truck, ArrowLeft, Loader2, Minus, Plus, Check
} from 'lucide-react';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import { useCartStore } from '../store/useCartStore';
import { useAuthStore } from '../store/useAuthStore';
import { useTheme } from '../context/ThemeContext';
import { formatVND, formatVNDNumber, USD_TO_VND_RATE } from '../utils/format';
import { playTick, vibrate } from '../utils/sfx';
import TiltCard from '../components/TiltCard';
import ProductImage from '../components/ProductImage';
import RarityBadge from '../components/RarityBadge';

const RANGE_LABELS = {
  month: '1 Month Snapshot',
  quarter: '3 Month Snapshot',
  'semi-annual': '6 Month Snapshot',
  annual: '1 Year Snapshot'
};

const CONDITION_LABELS = {
  MINT: 'Mint',
  NEAR_MINT: 'Near Mint',
  LIGHTLY_PLAYED: 'Lightly Played',
  MODERATELY_PLAYED: 'Moderately Played',
  HEAVILY_PLAYED: 'Heavily Played'
};

const VARIANT_LABELS = {
  NORMAL: 'Standard',
  HOLOFOIL: 'Holofoil',
  REVERSE_HOLOFOIL: 'Reverse Holofoil',
  '1ST_EDITION': '1st Edition',
  '1ST_EDITION_HOLOFOIL': '1st Edition Holofoil',
  UNLIMITED_HOLOFOIL: 'Unlimited Holofoil'
};

const formatCondition = (c) => CONDITION_LABELS[c] || (c ? c.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()) : 'Near Mint');
const formatVariant = (v) => VARIANT_LABELS[v] || (v && v !== '' ? v.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase()) : 'Standard');

const CHART_THEMES = {
  light: {
    grid: '#e2e8f0', text: '#94a3b8', axis: '#cbd5e1',
    bar: '#ede9fe', barRing: 'rgba(196,181,253,0.6)', cursor: '#c4b5fd'
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
  const cacheRef = useRef(new Map());
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const { theme } = useTheme();
  const chartTheme = CHART_THEMES[theme] || CHART_THEMES.light;

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
      try {
        const response = await api.get(`/products/${id}`);
        const data = response.data.data;
        setProduct(data);
        const available = data.variants?.find(v => v.stockQuantity > 0) || data.variants?.[0];
        if (available) setSelectedVariantId(available.id);
      } catch (err) {
        console.error('Failed to load product:', err);
        setError('Product not found.');
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const selectedVariant = product?.variants?.find(v => v.id === selectedVariantId);

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
        params: {
          range,
          condition,
          variant
        }
      });
      const data = response.data.data;
      const normalizedData = {
        chart_data: data.chart_data || [],
        price_metrics: data.price_metrics || {
          comparison_prices: [],
          price_points: null,
          snapshot: null
        }
      };
      cacheRef.current.set(cacheKey, normalizedData);
      setPriceData(normalizedData);
    } catch (err) {
        console.error('Failed to load price history:', err);
    } finally {
      setIsLoadingRange(false);
    }
  }, [product?.tcgplayerId, selectedVariant]);

  useEffect(() => {
    if (product?.tcgplayerId) {
      loadPriceData(priceRange);
    }
  }, [product?.tcgplayerId, priceRange, selectedVariant, loadPriceData]);

  const handleAddToCart = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/product/${id}` } });
      return;
    }
    if (!selectedVariantId || !selectedVariant) return;

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
    setTimeout(() => navigate('/cart'), 750);
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
        <p className="text-rose-500 font-medium">{error || 'Product not found'}</p>
        <button onClick={() => navigate('/catalog')} className="btn-ghost mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to catalog
        </button>
      </div>
    );
  }

  const chartData = priceData?.chart_data || [];
  const metrics = priceData?.price_metrics || null;

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

  // Right axis: volume scale maxes at 6000 with 1500 steps (grows only if data exceeds it)
  const volumeTop = Math.max(6000, Math.ceil(Math.max(...chartDataMapped.map(d => d.quantitySold), 0) / 1500) * 1500);
  const volumeTicks = Array.from({ length: volumeTop / 1500 + 1 }, (_, i) => i * 1500);

  const snapshotTitle = RANGE_LABELS[priceRange] || 'Snapshot';

  const CustomTooltip = ({ active, payload, label }) => {
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
          {data.quantitySold} items sold
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
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 app-bg animate-tcg-reveal">
      <button onClick={() => navigate(-1)} className="btn-ghost mb-6 !px-3">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Product image */}
        <div className="lg:sticky lg:top-24 self-start">
          <div className="relative overflow-hidden rounded-3xl glass-panel-strong aura-glow p-8 sm:p-10 flex items-center justify-center" style={{ minHeight: '300px' }}>
            <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-fuchsia-400/15 blur-[80px] animate-tcg-float" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-primary-400/15 blur-[80px] animate-tcg-float-slow" />
            {product.rarity && (
              <div className="absolute top-4 left-4 z-20">
                <RarityBadge rarity={product.rarity} size="lg" />
              </div>
            )}
            <TiltCard max={16} scale={1.05} rarity={product.rarity} className="relative w-full flex items-center justify-center">
              <ProductImage
                src={product.images && product.images.length > 0 ? product.images[0] : null}
                alt={product.name}
                className="relative max-h-[440px] w-auto object-contain drop-shadow-[0_24px_40px_rgba(15,23,42,0.35)] dark:drop-shadow-[0_24px_50px_rgba(34,211,238,0.25)]"
                fallbackClassName="h-[380px] w-full rounded-2xl"
                iconClassName="h-12 w-12 text-white/90"
                label={product.shortName || product.name || 'No image'}
              />
            </TiltCard>
          </div>
        </div>

        {/* Details */}
        <div>
          {product.rarity && (
            <div className="mb-3">
              <RarityBadge rarity={product.rarity} size="lg" />
            </div>
          )}
          <h1 className="heading-display text-3xl sm:text-4xl leading-tight">{product.name}</h1>
          {product.sets && product.sets.length > 0 && (
            <p className="text-ink-500 dark:text-ink-300 mt-2 font-medium">{product.sets.map(s => s.name).join(', ')}</p>
          )}

          <div className="mt-4 flex items-center gap-2.5">
            <div className="flex text-amber-400">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-[18px] w-[18px] fill-current" />)}
            </div>
            <span className="text-sm text-ink-400 dark:text-ink-300">(0 reviews)</span>
          </div>

          <div className="mt-6 inline-flex items-baseline gap-3 rounded-2xl bg-brand-gradient-soft ring-1 ring-primary-200/60 px-5 py-3.5">
            <span className="text-3xl sm:text-4xl font-display font-bold text-gradient-brand">
              {selectedVariant ? formatVND(selectedVariant.price) : 'Select condition'}
            </span>
          </div>

          {product.variants && product.variants.length > 0 && (
            <div className="mt-6">
              <label className="label-premium">Condition & Card Type</label>
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
                      {formatCondition(v.condition)} <span className={isSelected ? 'text-white/70' : 'text-faint'}>•</span> {formatVariant(v.variant)}
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                        inStock
                          ? 'bg-emerald-400/15 text-emerald-600 dark:text-emerald-300'
                          : 'bg-rose-400/15 text-rose-500'
                      } ${isSelected ? 'bg-white/20 text-white' : ''}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${inStock ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                        {inStock ? `${v.stockQuantity} available` : 'Sold out'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-7 flex items-stretch gap-3">
            <div className="inline-flex items-center self-stretch rounded-xl border border-subtle surface overflow-hidden shrink-0">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-3 text-ink-500 dark:text-ink-300 hover:text-primary-700 hover:bg-primary-50 transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="px-5 py-3 font-bold text-ink-900 dark:text-white min-w-[3rem] text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(selectedVariant?.stockQuantity || 10, quantity + 1))}
                className="p-3 text-ink-500 dark:text-ink-300 hover:text-primary-700 hover:bg-primary-50 transition-colors"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={!selectedVariantId || !selectedVariant?.stockQuantity || added}
              className={`btn-primary flex-1 w-full !py-3.5 text-base ${added ? '!from-emerald-500 !to-teal-500' : ''}`}
            >
              {added ? (<><Check className="h-5 w-5" /> Added!</> ) : (<><ShoppingCart className="h-5 w-5" /> Add to cart</>)}
            </button>
          </div>

          {product.description && (
            <div className="mt-6 p-5 rounded-2xl glass-panel text-muted text-sm leading-relaxed whitespace-pre-wrap">
              {product.description}
            </div>
          )}

          <div className="mt-5 space-y-2 text-sm">
            {product.artist && <p className="text-ink-600 dark:text-ink-200"><strong className="text-ink-800 dark:text-white">Artist:</strong> {product.artist}</p>}
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-400/10 ring-1 ring-emerald-100 dark:ring-emerald-400/20 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
              <Shield className="h-[18px] w-[18px] text-emerald-600" /> 100% Authentic
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-primary-50/80 dark:bg-primary-400/10 ring-1 ring-primary-100 dark:ring-primary-400/20 px-4 py-3 text-sm font-medium text-primary-800 dark:text-primary-200">
              <Truck className="h-[18px] w-[18px] text-primary-600" /> Fast shipping
            </div>
          </div>
        </div>
      </div>

      {/* ==================== MARKET PRICE TRENDS ==================== */}
      {product.tcgplayerId && (
        <div className="relative mt-12 overflow-hidden rounded-3xl glass-panel p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-24 right-1/4 h-64 w-64 rounded-full bg-fuchsia-400/10 blur-[90px]" />
          <div className="mb-6">
            <p className="section-eyebrow">Market Insights</p>
            <h2 className="heading-display text-2xl mt-1">Market price trends</h2>
          </div>

          {priceData === null && !isLoadingRange ? (
            <p className="text-ink-400 dark:text-ink-300">No price history data.</p>
          ) : (
            <div className="relative">
              {isLoadingRange && (
                <div className="absolute inset-0 bg-white/60 dark:bg-ink-950/60 backdrop-blur-sm z-20 flex items-center justify-center rounded-2xl">
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
                            barSize={14}
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
                      <span className="w-3 h-3 rounded-sm bg-[#ede9fe] dark:bg-primary-500/30 ring-1 ring-primary-200 dark:ring-primary-400/30 mr-1.5"></span>
                      Items Sold
                    </div>
                    <div className="flex items-center">
                      <span className="w-3 h-3 rounded-full bg-gradient-to-r from-primary-600 to-fuchsia-500 mr-1.5"></span>
                      Market Price
                    </div>
                  </div>
                </div>

                {/* Right column: Stats */}
                <div className="space-y-4">
                  <div className="rounded-2xl bg-gradient-to-br from-primary-50/80 to-fuchsia-50/60 ring-1 ring-primary-200/50 p-5 dark:from-white/5 dark:to-aura-violet/10 dark:ring-white/10">
                    <h3 className="font-display font-bold text-ink-900 dark:text-white">Price & Market Stats</h3>
                    <div className="mt-4 space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-ink-500 dark:text-ink-300">Market Price</span>
                        <span className="text-xl font-bold text-gradient-brand">
                          {metrics?.price_points ? formatCurrency(metrics.price_points.marketPrice) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-ink-500 dark:text-ink-300">Most Recent Sale</span>
                        <span className="text-sm font-semibold text-ink-700 dark:text-ink-100">
                          {metrics?.price_points ? formatCurrency(metrics.price_points.mostRecentSale) : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm text-ink-500 dark:text-ink-300">
                          {metrics?.price_points?.volatility || 'Med Volatility'}
                        </span>
                        <div className="w-full h-1.5 bg-white/80 dark:bg-[#12121a]/80 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500" style={{ width: '50%' }} />
                        </div>
                      </div>
                    </div>

                    {metrics?.comparison_prices?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-primary-200/40">
                        <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2.5">Near Mint Comparison Prices</p>
                        <div className="flex flex-wrap gap-2">
                          {metrics.comparison_prices.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white/85 dark:bg-white/10 rounded-lg px-3 py-1.5 ring-1 ring-primary-200/50 dark:ring-white/10 shadow-sm">
                              <span className="text-sm text-ink-500 dark:text-ink-300">{item.label}:</span>
                              <span className="font-bold text-ink-800 dark:text-white">{formatCurrency(item.value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl surface p-5">
                    <h3 className="font-display font-bold text-ink-900 dark:text-white">{snapshotTitle}</h3>
                    {metrics?.snapshot ? (
                      <div className="grid grid-cols-2 gap-2.5 mt-4">
                        <div className="rounded-xl surface-2 p-3 text-center">
                          <p className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300 font-semibold">Low Sale Price</p>
                          <p className="font-bold text-ink-800 dark:text-white mt-1">{formatCurrency(metrics.snapshot.lowSalePrice)}</p>
                        </div>
                        <div className="rounded-xl surface-2 p-3 text-center">
                          <p className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300 font-semibold">High Sale Price</p>
                          <p className="font-bold text-ink-800 dark:text-white mt-1">{formatCurrency(metrics.snapshot.highSalePrice)}</p>
                        </div>
                        <div className="rounded-xl surface-2 p-3 text-center">
                          <p className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300 font-semibold">Total Sold</p>
                          <p className="font-bold text-ink-800 dark:text-white mt-1">{formatNumber(metrics.snapshot.totalSold)}</p>
                        </div>
                        <div className="rounded-xl surface-2 p-3 text-center">
                          <p className="text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300 font-semibold">Avg. Daily Sold</p>
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
  );
};

export default ProductDetail;
