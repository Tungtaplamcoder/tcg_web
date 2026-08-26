import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, SlidersHorizontal, Package, ChevronLeft, ChevronRight, Sparkles, X, Tag
} from 'lucide-react';
import api from '../services/api';
import { formatVND } from '../utils/format';

/* Derive display price (lowest variant) — price lives on ProductVariant, not Product */
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
  const [isHovered, setIsHovered] = useState(false);

  const price = getMinPrice(product);
  const stock = getStock(product);
  const inStock = stock > 0;

  return (
    <Link
      to={`/product/${product.id}`}
      className="group relative bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl shadow-card hover:shadow-card-hover hover:border-fuchsia-200 hover:-translate-y-1.5 transition-all duration-300 overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 bg-gradient-to-br from-fuchsia-500/15 via-transparent to-violet-500/15 pointer-events-none transition-opacity duration-500 z-10" />

      <div className="relative h-64 overflow-visible flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.shortName || product.name}
            className="w-full h-full object-contain drop-shadow-xl transition-transform duration-500 ease-out group-hover:scale-110 group-hover:-rotate-2"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <Package className="h-12 w-12" />
          </div>
        )}
        {/* Preserved shine sweep on hover */}
        {isHovered && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent -translate-x-full animate-shine" />
          </div>
        )}

        {/* rarity badge */}
        {product.rarity && (
          <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-white/90 backdrop-blur px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-700 ring-1 ring-fuchsia-100 shadow-sm">
            <Tag className="h-3 w-3" />
            {product.rarity}
          </span>
        )}
      </div>

      <div className="relative p-4 z-10">
        <h3 className="font-semibold text-gray-900 truncate" title={product.shortName || product.name}>
          {product.shortName || product.name}
        </h3>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-lg font-bold bg-gradient-to-r from-fuchsia-600 to-violet-600 bg-clip-text text-transparent">
            {price !== null ? formatVND(price) : 'Liên hệ'}
          </span>
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${inStock ? 'text-emerald-700 bg-emerald-50 ring-1 ring-emerald-100' : 'text-rose-600 bg-rose-50 ring-1 ring-rose-100'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {inStock ? `Còn ${stock}` : 'Hết hàng'}
          </span>
        </div>
      </div>
    </Link>
  );
};

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
    } catch (err) { console.error(err); setError('Không thể tải sản phẩm.'); } finally { setLoading(false); }
  }, [page, search, setFilter, rarityFilter, minPrice, maxPrice, inStock]);

  useEffect(() => { fetchSets(); }, [fetchSets]);
  useEffect(() => { fetchProducts(); }, [fetchProducts]);

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* ===================== HEADER ===================== */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-violet-700 via-fuchsia-600 to-pink-500 text-white p-8 sm:p-10 mb-8">
        <div className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/15 blur-[90px] animate-tcg-float" />
        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold flex items-center">
              <Sparkles className="h-8 w-8 mr-3 text-pink-100" />
              Bộ sưu tập Cards
            </h1>
            <p className="mt-2 text-white/80">
              {loading ? 'Đang tải…' : `${meta.totalItems} sản phẩm`}
            </p>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/25 rounded-full text-white hover:bg-white/20 transition-all shrink-0"
          >
            <SlidersHorizontal className="h-4 w-4 mr-2" />
            {showFilters ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
          </button>
        </div>
      </div>

      {/* ===================== SEARCH ===================== */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm sản phẩm…"
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400 focus:border-transparent transition-all"
            />
          </div>
          <button type="submit" className="px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white font-semibold rounded-2xl hover:shadow-lg hover:shadow-fuchsia-200 transition-all">
            Tìm
          </button>
        </div>
      </form>

      {/* ===================== FILTERS ===================== */}
      {showFilters && (
        <div className="mb-6 p-6 bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-100 shadow-card animate-tcg-reveal">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-800">Bộ lọc</h2>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="inline-flex items-center text-sm text-rose-500 hover:text-rose-600 font-medium">
                <X className="h-4 w-4 mr-1" /> Xóa tất cả
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bộ / Series</label>
              <select value={setFilter} onChange={(e) => setSetFilter(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-400 bg-white">
                <option value="">Tất cả</option>
                {sets.map((set) => <option key={set.id} value={set.slug}>{set.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Độ hiếm (Rarity)</label>
              <input
                type="text"
                value={rarityFilter}
                onChange={(e) => setRarityFilter(e.target.value)}
                placeholder="Ví dụ: Ultra Rare"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Khoảng giá</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="Từ" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-400" />
                <input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Đến" className="w-full px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-400" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 lg:col-span-3 pt-1 cursor-pointer select-none">
              <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-fuchsia-600 focus:ring-fuchsia-400" />
              <span>Chỉ hiện sản phẩm còn hàng</span>
            </label>
          </div>
        </div>
      )}

      {error && <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl mb-2">{error}</div>}

      {/* ===================== GRID ===================== */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, idx) => (
            <div key={idx} className="bg-white rounded-3xl p-4 shadow-card">
              <div className="h-64 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl mb-3 animate-pulse"></div>
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-100 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <div className="h-20 w-20 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
            <Package className="h-10 w-10 text-gray-300" />
          </div>
          <p className="mt-5 text-lg font-medium text-gray-700">Không tìm thấy sản phẩm nào.</p>
          <p className="mt-1 text-sm text-gray-400">Thử điều chỉnh bộ lọc hoặc từ khóa tìm kiếm.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
          {meta.totalPages > 1 && (
            <div className="mt-10 flex justify-center items-center gap-3">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="inline-flex items-center p-2.5 border border-gray-200 rounded-xl text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-medium text-gray-700">Trang {meta.page} / {meta.totalPages}</span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= meta.totalPages}
                className="inline-flex items-center p-2.5 border border-gray-200 rounded-xl text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Catalog;
