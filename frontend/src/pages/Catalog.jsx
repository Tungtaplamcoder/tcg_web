import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, SlidersHorizontal, Package, ChevronLeft, ChevronRight, ChevronDown, Sparkles, X
} from 'lucide-react';
import api from '../services/api';
import { formatVND } from '../utils/format';
import ProductCard from '../components/ProductCard';
import { useLanguage } from '../i18n/LanguageContext';

const PRICE_MIN = 0;
const PRICE_MAX = 20000000;
const PRICE_STEP = 100000;

// Accept legacy `box`/`card` deep links and semantic keys alike — any
// other value already is a tree slug (series or expansion set) and is
// passed through untouched.
const normalizeCategory = (value) => {
  const key = String(value || '').trim().toLowerCase();
  if (!key) return '';
  if (key === 'box') return 'sealed-products';
  if (key === 'card') return 'single-cards';
  return key;
};

/* Multi-value URL param ("a,b") <-> array helpers */
const parseList = (raw) => (raw ? String(raw).split(',').map((v) => v.trim()).filter(Boolean) : []);

/* ------------------------------------------------------------------ */
/* Nested category tree (accordion): roots -> series/era -> expansions  */
/* ------------------------------------------------------------------ */
const CategoryTree = ({ categories, selected, onSelect, heading }) => {
  const { byParent, nodes } = useMemo(() => {
    const byParent = {};
    const nodes = {};
    categories.forEach((c) => {
      nodes[c.id] = c;
      const key = c.parentId || '__root__';
      (byParent[key] = byParent[key] || []).push(c);
    });
    Object.values(byParent).forEach((list) => list.sort((a, b) => a.name.localeCompare(b.name)));
    return { byParent, nodes };
  }, [categories]);

  // Auto-expand the ancestors of the currently selected node
  const [open, setOpen] = useState(() => new Set());
  useEffect(() => {
    const sel = categories.find((c) => c.slug === selected);
    if (!sel) return;
    const next = new Set(open);
    let cur = sel;
    let guard = 0;
    while (cur?.parentId && guard++ < 6) {
      next.add(cur.parentId);
      cur = nodes[cur.parentId];
    }
    setOpen(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const renderNode = (node, depth) => {
    // Prune nodes with zero active products — only show nodes that have
    // at least one product (directly or through a descendant).
    const hasOwnProducts = (node.count || 0) > 0;
    const childList = byParent[node.id] || [];
    const visibleChildren = childList
      .map((c) => ({ node: c, visible: (c.count || 0) > 0 || (byParent[c.id] || []).some((gc) => (gc.count || 0) > 0) }))
      .filter((x) => x.visible)
      .map((x) => x.node);
    const hasChildren = visibleChildren.length > 0;
    if (!hasOwnProducts && !hasChildren) return null;
    const isOpen = open.has(node.id);
    const isActive = selected === node.slug;
    return (
      <li key={node.id}>
        <div
          className={`flex items-center rounded-lg transition-colors ${isActive ? 'bg-primary-50 dark:bg-white/10 text-primary-700 dark:text-white font-semibold' : 'text-strong hover:bg-ink-50 dark:hover:bg-white/5'}`}
          style={{ paddingLeft: `${depth * 14}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setOpen((prev) => { const next = new Set(prev); next.has(node.id) ? next.delete(node.id) : next.add(node.id); return next; })}
              aria-label={isOpen ? `Collapse ${node.name}` : `Expand ${node.name}`}
              aria-expanded={isOpen}
              className="p-1.5"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
            </button>
          ) : (
            <span className="w-[26px]" />
          )}
          <button
            type="button"
            onClick={() => onSelect(isActive ? '' : node.slug)}
            aria-current={isActive ? 'true' : undefined}
            className="flex-1 text-left py-1.5 pr-2 text-sm truncate"
          >
            {node.name}
            {node.count > 0 && <span className="ml-1.5 text-xs text-muted">({node.count})</span>}
          </button>
        </div>
        {hasChildren && isOpen && (
          <ul>{visibleChildren.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <div data-testid="category-tree">
      <label className="label-premium">{heading}</label>
      <ul className="space-y-0.5">
        {(byParent['__root__'] || []).map((root) => renderNode(root, 0))}
      </ul>
    </div>
  );
};

/* Checkbox facet list (Artist / Rarity) */
const FacetCheckboxes = ({ title, items, selected, onToggle, testId }) => {
  if (!items || items.length === 0) return null;
  return (
    <div data-testid={testId}>
      <label className="label-premium">{title}</label>
      <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item.value}>
            <label className="flex items-center gap-2.5 text-sm text-strong cursor-pointer select-none">
              <input
                type="checkbox"
                checked={selected.includes(item.value)}
                onChange={() => onToggle(item.value)}
                className="h-4 w-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="flex-1 truncate">{item.value}</span>
              <span className="text-xs text-muted">{item.count}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
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

const FacetChip = ({ label, onRemove, t }) => (
  <span className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full bg-gradient-to-r from-primary-600 to-fuchsia-600 text-white text-xs font-semibold shadow-sm animate-tcg-scale-in">
    {label}
    <button onClick={onRemove} aria-label={`${t('common.close')} ${label}`} className="touch-manipulation rounded-full bg-white/20 hover:bg-white/35 p-0.5 transition-colors">
      <X className="h-3 w-3" />
    </button>
  </span>
);

const Catalog = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [categoryFilter, setCategoryFilter] = useState(normalizeCategory(searchParams.get('category')));
  const [artistFilter, setArtistFilter] = useState(parseList(searchParams.get('artist')));
  const [rarityFilter, setRarityFilter] = useState(parseList(searchParams.get('rarity')));
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [inStock, setInStock] = useState(searchParams.get('inStock') === 'true');
  const [facets, setFacets] = useState({ categories: [], artists: [], rarities: [] });

  const page = parseInt(searchParams.get('page') || '1', 10);
  const debounceRef = useRef(null);

  /* Keep the URL shareable: category slug, artist and rarity checkboxes
   * all live in the query string (?category=cosmic-eclipse&artist=…). */
  useEffect(() => {
    const params = {};
    if (search) params.search = search;
    if (categoryFilter) params.category = categoryFilter;
    if (artistFilter.length) params.artist = artistFilter.join(',');
    if (rarityFilter.length) params.rarity = rarityFilter.join(',');
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (inStock) params.inStock = 'true';
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, artistFilter, rarityFilter, minPrice, maxPrice, inStock, page]);

  const fetchProducts = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (artistFilter.length) params.artist = artistFilter.join(',');
      if (rarityFilter.length) params.rarity = rarityFilter.join(',');
      if (minPrice) params.minPrice = minPrice;
      if (maxPrice) params.maxPrice = maxPrice;
      if (inStock) params.inStock = 'true';

      const response = await api.get('/products', { params });
      setProducts(response.data.data.items || []);
      setMeta(response.data.data.meta || { page: 1, limit: 20, totalItems: 0, totalPages: 1 });
    } catch (err) { console.error(err); setError('Failed to load products.'); }
    finally { setLoading(false); }
  }, [page, search, categoryFilter, artistFilter, rarityFilter, minPrice, maxPrice, inStock]);

  // Facet rail: category tree + artist/rarity values with sibling counts.
  const fetchFacets = useCallback(async () => {
    try {
      const params = {};
      if (categoryFilter) params.category = categoryFilter;
      if (artistFilter.length) params.artist = artistFilter.join(',');
      if (rarityFilter.length) params.rarity = rarityFilter.join(',');
      const response = await api.get('/products/facets', { params });
      setFacets(response.data.data || { categories: [], artists: [], rarities: [] });
    } catch (err) { console.error(err); }
  }, [categoryFilter, artistFilter, rarityFilter]);

  /* Debounced fetch so dragging the slider doesn't spam the API */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchProducts, 280);
    return () => clearTimeout(debounceRef.current);
  }, [fetchProducts]);

  useEffect(() => { fetchFacets(); }, [fetchFacets]);

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

  const toggleIn = (list, setter, value) =>
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const clearFilters = () => {
    setSearch(''); setCategoryFilter(''); setArtistFilter([]); setRarityFilter([]);
    setMinPrice(''); setMaxPrice(''); setInStock(false);
    setSearchParams({});
  };

  const categoryLabel = facets.categories.find((c) => c.slug === categoryFilter)?.name || categoryFilter;
  const hasActiveFilters = search || categoryFilter || artistFilter.length > 0 || rarityFilter.length > 0 || minPrice || maxPrice || inStock;
  const activeChips = [
    search && { key: 's', label: `“${search}”`, clear: () => setSearch('') },
    categoryFilter && { key: 'cat', label: categoryLabel, clear: () => setCategoryFilter('') },
    ...artistFilter.map((a) => ({ key: `artist-${a}`, label: a, clear: () => setArtistFilter(artistFilter.filter((v) => v !== a)) })),
    ...rarityFilter.map((r) => ({ key: `rarity-${r}`, label: r, clear: () => setRarityFilter(rarityFilter.filter((v) => v !== r)) })),
    (minPrice || maxPrice) && { key: 'p', label: `${minPrice ? formatVND(Number(minPrice)) : '0'} – ${maxPrice ? formatVND(Number(maxPrice)) : 'Max'}`, clear: () => { setMinPrice(''); setMaxPrice(''); } },
    inStock && { key: 'stock', label: t('catalog.chipStock'), clear: () => setInStock(false) }
  ].filter(Boolean);

  const FilterRail = (
    <div className="p-6 glass-panel rounded-3xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-display font-bold text-lg text-strong">{t('catalog.filters')}</h2>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="inline-flex items-center text-sm text-rose-500 hover:text-rose-600 font-medium">
            <X className="h-4 w-4 mr-1" /> {t('catalog.clear')}
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Nested category accordion: Level 1 (Single Cards / Sealed
            Products / Accessories) → Level 2 (era/series or product type)
            → Level 3 (expansion set) */}
        <CategoryTree
          categories={facets.categories}
          selected={categoryFilter}
          onSelect={setCategoryFilter}
          heading={t('catalog.category')}
        />

        <FacetCheckboxes
          title="Artist (Họa sĩ)"
          testId="filter-artists"
          items={facets.artists}
          selected={artistFilter}
          onToggle={(v) => toggleIn(artistFilter, setArtistFilter, v)}
        />

        <FacetCheckboxes
          title="Rarity (Độ hiếm)"
          testId="filter-rarities"
          items={facets.rarities}
          selected={rarityFilter}
          onToggle={(v) => toggleIn(rarityFilter, setRarityFilter, v)}
        />

        <div>
          <label className="label-premium">{t('catalog.priceRange')}</label>
          <RangeSlider min={minPrice} max={maxPrice} onChange={(lo, hi) => { setMinPrice(String(lo)); setMaxPrice(String(hi)); }} />
        </div>

        <label className="flex items-center gap-3 text-sm font-medium text-strong cursor-pointer select-none">
          <span className={`relative h-5 w-9 rounded-full transition-colors duration-300 ${inStock ? 'bg-gradient-to-r from-primary-600 to-fuchsia-600' : 'bg-ink-200 dark:bg-white/10'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-300 ${inStock ? 'left-4' : 'left-0.5'}`} />
          </span>
          {t('catalog.inStock')}
          <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="sr-only" />
        </label>
      </div>
    </div>
  );

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-rose-50/40 via-purple-50/20 to-white dark:from-[#0d0714] dark:to-[#09040e]">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* ===================== HEADER ===================== */}
        <div className="relative overflow-hidden rounded-[2rem] glass-panel p-8 sm:p-10 mb-8">
          <div className="pointer-events-none absolute -top-20 -right-12 h-56 w-56 rounded-full bg-aura-violet/25 blur-[90px] dark:bg-aura-magenta/25" />
          <div className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-aura-cyan/15 blur-[80px]" />
          <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center font-display text-strong tracking-tight">
                <Sparkles className="h-8 w-8 mr-3 text-fuchsia-500 dark:text-aura-cyan" />
                {t('catalog.title')}
              </h1>
              <p className="mt-2 text-muted">{loading ? t('common.loading') : t('catalog.productsCount', { count: meta.totalItems })}</p>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden btn-secondary !py-2.5 shrink-0"
            >
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              {showFilters ? t('catalog.hideFilters') : t('catalog.showFilters')}
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
                placeholder={t('catalog.searchPlaceholder')}
                className="input-premium pl-11 pr-4 py-3"
              />
            </div>
            <button type="submit" className="btn-primary">{t('common.search')}</button>
          </div>
        </form>

        {/* ===================== ACTIVE FACET CHIPS ===================== */}
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-5 animate-tcg-reveal">
            {activeChips.map((c) => <FacetChip key={c.key} label={c.label} onRemove={c.clear} t={t} />)}
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
                <p className="mt-5 text-lg font-medium text-strong">{t('catalog.noProducts')}</p>
                <p className="mt-1 text-sm text-muted">{t('catalog.noProductsHint')}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 [transition:all_0.4s_ease]">
                  {products.map((product, i) => {
                    /* Catalog-specific sealed detection: never let a sealed
                     * box fall back to the Pokémon card-back motif. */
                    const isSealed = product?.main_type === 'SEALED_PRODUCT'
                      || product?.mainType === 'SEALED_PRODUCT'
                      || product?.isSealed === true;
                    return (
                      <div key={product.id} className="animate-tcg-reveal will-change-transform translate-z-0" style={{ animationDelay: `${Math.min(i * 0.04, 0.4)}s` }}>
                        <ProductCard product={product} sealed={isSealed} />
                      </div>
                    );
                  })}
                </div>
                {meta.totalPages > 1 && (
                  <div className="mt-10 flex justify-center items-center gap-3">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      className="inline-flex items-center p-2.5 rounded-xl surface text-strong touch-manipulation will-change-transform translate-z-0 disabled:opacity-40 hover:ring-iridescent transition-all"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <span className="text-sm font-medium text-muted">{t('common.page', { page: meta.page, total: meta.totalPages })}</span>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= meta.totalPages}
                      className="inline-flex items-center p-2.5 rounded-xl surface text-strong touch-manipulation will-change-transform translate-z-0 disabled:opacity-40 hover:ring-iridescent transition-all"
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
    </div>
  );
};

export default Catalog;
