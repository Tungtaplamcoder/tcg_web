import React from 'react';
import { Link } from 'react-router-dom';
import ProductImage from './ProductImage';
import { formatVND } from '../utils/format';
import { useLanguage } from '../i18n/LanguageContext';
import { resolveProductMainType, MAIN_TYPES } from '../constants/productCategories';

/* Sealed detection across every payload shape the API may ship:
 * explicit main_type/mainType/productType, a boolean isSealed flag, or a
 * category whose name/slug lives under "sealed". `resolveProductMainType`
 * covers the explicit + category cases; the isSealed flag is checked
 * directly here. A `sealed` prop from the caller stays authoritative. */
const detectSealed = (product, sealed) => (
  sealed === true
  || product?.isSealed === true
  || resolveProductMainType(product) === MAIN_TYPES.SEALED_PRODUCT
);

/* The public /products list payload ships raw `variants[]` (each with
 * `price` + `stockQuantity`) and no pre-aggregated price/stock. Derive the
 * card figures from the variant set, while still honoring explicit
 * aggregate fields in either casing when a payload provides them. */
const derivePriceAndStock = (product) => {
  const variants = Array.isArray(product.variants) ? product.variants.filter(Boolean) : [];

  const prices = variants
    .map((v) => Number(v.price))
    .filter((n) => Number.isFinite(n));
  const stocks = variants
    .map((v) => Number(v.stockQuantity))
    .filter((n) => Number.isFinite(n));

  const rawPrice = product.minPrice ?? product.price ?? product.min_price;
  const rawStock = product.totalStock ?? product.stock ?? product.total_stock;

  const price = rawPrice ?? (prices.length ? Math.min(...prices) : 0);
  const stock = rawStock ?? (stocks.length ? stocks.reduce((sum, n) => sum + n, 0) : 0);

  return {
    price: Number(price) > 0 ? Number(price) : 0,
    stock: Number(stock) > 0 ? Number(stock) : 0
  };
};

const ProductCard = ({ product, sealed = false }) => {
  const { t } = useLanguage();
  if (!product) return null;

  const { price: displayPrice, stock: totalStock } = derivePriceAndStock(product);
  const inStock = Number(totalStock) > 0;

  const isSealedProduct = detectSealed(product, sealed);

  return (
    <Link
      to={`/product/${product.id}`}
      className="group relative flex flex-col w-full h-full overflow-hidden rounded-3xl border border-primary-100/60 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg dark:border-white/10 dark:bg-white/[0.04]"
    >
      {/* 1. CONTAINER ẢNH VÀ BADGE TRÊN */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gradient-to-br from-blush-50 to-primary-50/40 p-3.5 dark:from-white/5 dark:to-white/[0.02]">
        <div className="absolute top-3 left-3 z-10">
          <span
            data-testid="product-badge"
            data-sealed={isSealedProduct ? 'true' : 'false'}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ${
              isSealedProduct
                ? 'bg-emerald-600 ring-emerald-700/40'
                : 'bg-fuchsia-600 ring-fuchsia-700/40'
            }`}
          >
            {isSealedProduct ? t('product.badgeSealed') : t('product.badgeCard')}
          </span>
        </div>

        <div className="w-full h-full rounded-2xl overflow-hidden flex items-center justify-center">
          <ProductImage
            src={product.images?.[0] || product.image || product.front_image}
            alt={product.name}
            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 group-hover:will-change-transform motion-reduce:transition-none"
            sealed={isSealedProduct}
          />
        </div>
      </div>

      {/* 2. FOOTER CONTAINER (TÊN, GIÁ & BADGE TỒN KHO) */}
      <div className="flex flex-col justify-between flex-1 min-w-0 p-4 pt-2">
        {/* Tên sản phẩm — break-words + min-h giữ layout ổn định với tiếng Việt */}
        <h3 className="font-display font-semibold text-sm leading-snug text-ink-900 break-words line-clamp-2 min-h-[2.5rem] transition-colors group-hover:text-primary-600 dark:text-white">
          {product.name}
        </h3>

        {/* Khối Giá tiền & Badge tồn kho (layout dồn hàng dọc) */}
        <div className="mt-2.5 flex flex-col items-start gap-2 w-full min-w-0">
          {/* Dòng Giá tiền */}
          <span className="font-display font-bold text-primary-600 dark:text-primary-400 text-base truncate w-full">
            {formatVND(displayPrice)}
          </span>

          {/* Badge Tồn Kho xuống hàng riêng — giới hạn trong bề rộng thẻ */}
          <span
            className={`inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
              inStock
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${inStock ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="min-w-0 truncate">
              {inStock ? t('product.stockLeft', { count: totalStock }) : t('product.soldOut')}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;