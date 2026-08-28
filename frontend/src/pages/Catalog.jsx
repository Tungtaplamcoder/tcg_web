import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, SlidersHorizontal, Package, ChevronLeft, ChevronRight, Sparkles, X, Check
} from 'lucide-react';
import api from '../services/api';
import { formatVND } from '../utils/format';
import HoloCard from '../components/HoloCard';

const PRICE_MIN = 0;
const PRICE_MAX = 20000000;
const PRICE_STEP = 100000;

const RARITY_OPTIONS = ['Common', 'Uncommon', 'Rare', 'Holo Rare', 'Ultra Rare', 'Illustration Rare', 'Secret Rare', 'Rainbow Rare'];

const RARITY_DOTS = {
  Common: 'from-slate-400 to-slate-500',
  Uncommon: 'from-emerald-400 to-teal-500',
  Rare: 'from-indigo-400 via-violet-500 to-fuchsia-400',
  'Holo Rare': 'from-sky-400 via-blue-500 to-violet-400',
  'Ultra Rare': 'from-violet-500 via-fuchsia-500 to-pink-400',
  'Illustration Rare': 'from-sky-400 via-indigo-500 to-fuchsia-400',
  'Secret Rare': 'from-fuchsia-500 via-violet-500 to-cyan-400',
  'Rainbow Rare': 'from-rose-400 via-fuchsia-500 to-amber-300'
};

/* Dual-thumb price range slider with animated iridescent fill */
const RangeSlider = ({ min, max, onChange }) => {
  const lo = Number(min) || PRICE_MIN;
  const hi = Number(max) || PRICE_MAX;
  const pct = (v) => ((v - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;

  const setLo = (v) => onChange(Math.min(Number(v), hi - PRICE_STEP), hi);
  const setHi = (v) => onChange(lo, Math.max(Number(v), lo + PRICE_STEP));

  return (
    <div className="pt-2">
      <div className="relative h-6">
        {/* track */}
        <div className="absolute top-1/2 -translate-y-1/2 h-1.5 w-full rounded-full bg-ink-200 dark:bg-white/10" />
        {/* fill */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gradient-to-r from-primary-500 via-fuchsia-500 to-cyan-400"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        <input
          type="range" min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP} value={lo}
          onChange={(e) => setLo(e.target.value)}
          aria-label="Minimum price"
          className="range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
        />
        <input
          type="range" min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP} value={hi}
          onChange={(e) => setHi(e.target.value)}
          aria-label="Maximum price"
          className="range-thumb absolute inset-0 w-full appearance-none bg-transparent pointer-events-none"
        />
      </div>
      <div className="mt-2 flex justify-between text-xs font-semibold text-muted">
        <span>{formatVND(lo)}</span>
        <span>{formatVND(hi)}</span>
      </div>
    </div>
  );
};

const FacetChip = ({ label, onRemove }) => (
  <span className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full bg-gradient-to-r from-primary-600 to-fuchsia-600 text-white text-xs font-semibold shadow-sm animate-tcg-scale-in">
    {label}
    <button onClick={onRemove} aria-label={`Remove ${label}`} className="rounded-full bg-white/20 hover:bg-white/35 p-0.5 transition-colors">
      <X className="h-3 w-3" />
    </button>
  </span>
);

const Catalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sets, setSets] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [setFilter, setSetFilter] = useState(searchParams.get('set') || '');
  const [rarityFilter, setRarityFilter] = useState(searchParams.get('rarity') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [inStock, setInStock] = useState(searchParams.get('inStock') === 'true');

  const page = parseInt(searchParams.get('page') || '1', 10);
  const debounceRef = useRef(null);

  const fetchSets = useCallback(async () => {
    try {
      const response = await api.get('/sets');
      setSets(response.data.data || []);
    } catch (err) { console.error('Failed to load sets:', err); }
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (setFilter) params.set = setFilter;
      if (rarityFilter) params.rarity = rarityFilter;
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (inStock) params.inStock = 'true';

      const response = await api.get('/products', { params });
      setProducts(response.data.data.items || []);
      setMeta(response.data.data.meta || { page: 1, limit: 20, totalItems: 0, totalPages: 1 });
    } catch (err) { console.error(err); setError('Không thể tải sản phẩm.'); }
    finally { setLoading(false); }
  }, [page, search, setFilter, rarityFilter, minPrice, maxPrice, inStock]);

  useEffect(() => { fetchSets(); }, [fetchSets]);

  /* Debounced fetch so dragging the slider doesn't spam the API */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchProducts, 280);
    return () => clearTimeout(debounceRef.current);
  }, [fetchProducts]);

  const handleSearch = (e) => {
    e.preventDefault();
    const params = { page: '1' };
    if (search) params.search = search;
    setSearchParams(params);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= meta.totalPages) {
      const params = { ...Object.fromEntries(searchParams), page: String(newPage) };
      setSearchParams(params);
    }
  };

  const clearFilters = () => {
    setSearch(''); setSetFilter(''); setRarityFilter(''); setMinPrice(''); setMaxPrice(''); setInStock(false);
    setSearchParams({});
  };

  const hasActiveFilters = search || setFilter || rarityFilter || minPrice || maxPrice || inStock;
  const activeChips = [
    search && { key: 's', label: `“${search}”`, clear: () => setSearch('') },
    setFilter && { key: 'set', label: sets.find(s => s.slug === setFilter)?.name || setFilter, clear: () => setSetFilter('') },
    rarityFilter && { key: 'r', label: rarityFilter, clear: () => setRarityFilter('') },
    (minPrice || maxPrice) && { key: 'p', label: `${minPrice ? formatVND(Number(minPrice)) : '0'} – ${maxPrice ? formatVND(Number(maxPrice)) : 'Max'}`, clear: () => { setMinPrice(''); setMaxPrice(''); } },
    inStock && { key: 'stock', label: 'In stock', clear: () => setInStock(false) }
  ].filter(Boolean);

  const FilterRail = (
    <div className="p-6 glass-panel rounded-3xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold text-lg text-strong">Bộ lọc</h2>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="inline-flex items-center text-sm text-rose-500 hover:text-rose-600 font-medium">
            <X className="h-4 w-4 mr-1" /> Xóa
          </button>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <label className="label-premium">Bộ / Series</label>
          <select value={setFilter} onChange={(e) => setSetFilter(e.target.value)} className="input-premium">
            <option value="">Tất cả</option>
            {sets.map((set) => <option key={set.id} value={set.slug}>{set.name}</option>)}
          </select>
        </div>

        <div>
          <label className="label-premium">Độ hiếm (Rarity)</label>
          <div className="flex flex-wrap gap-2">
            {RARITY_OPTIONS.map((r) => {
              const active = rarityFilter.toLowerCase() === r.toLowerCase();
              return (
                <button
                  key={r}
                  onClick={() => setRarityFilter(active ? '' : r)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${
                    active
                      ? 'bg-gradient-to-r from-primary-600 to-fuchsia-600 text-white shadow-sm'
                      : 'bg-ink-100/70 dark:bg-white/5 text-muted hover:bg-primary-50 dark:hover:bg-white/10 hover:text-primary-700 dark:hover:text-white'
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full bg-gradient-to-r ${RARITY_DOTS[r]} ${active ? 'ring-1 ring-white/60' : ''}`} />
                  {active && <Check className="h-3 w-3" />}
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label-premium">Khoảng giá</label>
          <RangeSlider min={minPrice} max={maxPrice} onChange={(lo, hi) => { setMinPrice(String(lo)); setMaxPrice(String(hi)); }} />
        </div>

        <label className="flex items-center gap-3 text-sm font-medium text-strong cursor-pointer select-none">
          <span className={`relative h-5 w-9 rounded-full transition-colors duration-300 ${inStock ? 'bg-gradient-to-r from-primary-600 to-fuchsia-600' : 'bg-ink-200 dark:bg-white/10'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-300 ${inStock ? 'left-4' : 'left-0.5'}`} />
          </span>
          Chỉ hiện sản phẩm còn hàng
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="sr-only" />
        </label>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 app-bg">
      {/* ===================== HEADER ===================== */}
      <div className="relative overflow-hidden rounded-[2rem] glass-panel p-8 sm:p-10 mb-8">
        <div className="pointer-events-none absolute -top-20 -right-12 h-56 w-56 rounded-full bg-aura-violet/25 blur-[90px] dark:bg-aura-magenta/25" />
        <div className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-aura-cyan/15 blur-[80px]" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center font-display text-strong tracking-tight">
              <Sparkles className="h-8 w-8 mr-3 text-fuchsia-500 dark:text-aura-cyan" />
              Bộ sưu tập Cards
            </h1>
            <p className="mt-2 text-muted">{loading ? 'Đang tải…' : `${meta.totalItems} sản phẩm`}</p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="lg:hidden btn-secondary !py-2.5 shrink-0"
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            {showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
          </button>
        </div>
        {/* foil accent line */}
        <div aria-hidden="true" className="absolute bottom-0 left-8 right-8 h-px bg-iridescent opacity-60" />
      </div>

      {/* ===================== SEARCH ===================== */}
      <form onSubmit={handleSearch} className="mb-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-ink-400 dark:text-ink-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm sản phẩm…"
              className="input-premium pl-11 pr-4 py-3"
            />
          </div>
          <button type="submit" className="btn-primary">Tìm</button>
        </div>
      </form>

      {/* ===================== ACTIVE FACET CHIPS ===================== */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-5 animate-tcg-reveal">
          {activeChips.map((c) => <FacetChip key={c.key} label={c.label} onRemove={c.clear} />)}
        </div>
      )}

      <div className="grid lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* ===================== FILTER RAIL ===================== */}
        <aside className={`lg:sticky lg:top-24 ${showFilters ? 'block' : 'hidden'} lg:block`}>
          {FilterRail}
        </aside>

        {/* ===================== GRID ===================== */}
        <div>
          {error && <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl mb-2">{error}</div>}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, idx) => (
                <div key={idx} className="surface rounded-3xl p-2 animate-pulse">
                  <div className="h-64 bg-ink-100 dark:bg-white/5 rounded-2xl mb-3" />
                  <div className="h-4 bg-ink-100 dark:bg-white/5 rounded w-3/4 mb-2 mx-2" />
                  <div className="h-4 bg-ink-100 dark:bg-white/5 rounded w-1/2 mb-3 mx-2" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 text-muted">
              <div className="h-20 w-20 mx-auto rounded-full bg-ink-100 dark:bg-white/5 flex items-center justify-center">
                <Package className="h-10 w-10 text-ink-300" />
              </div>
              <p className="mt-5 text-lg font-medium text-strong">Không tìm thấy sản phẩm nào.</p>
              <p className="mt-1 text-sm text-muted">Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 [transition:all_0.4s_ease]">
                {products.map((product, i) => (
                  <div key={product.id} className="animate-tcg-reveal" style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}>
                    <HoloCard product={product} />
                  </div>
                ))}
              </div>
              {meta.totalPages > 1 && (
                <div className="mt-10 flex justify-center items-center gap-3">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="inline-flex items-center p-2.5 rounded-xl surface text-strong disabled:opacity-40 hover:ring-iridescent transition-all"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <span className="text-sm font-medium text-muted">Trang {meta.page} / {meta.totalPages}</span>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= meta.totalPages}
                    className="inline-flex items-center p-2.5 rounded-xl surface text-strong disabled:opacity-40 hover:ring-iridescent transition-all"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Catalog;
