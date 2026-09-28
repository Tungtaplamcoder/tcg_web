import React from 'react';
import { Link } from 'react-router-dom';
import ProductImage from './ProductImage';
import { formatVND } from '../utils/format';

const ProductCard = ({ product, sealed = false }) => {
  if (!product) return null;

  const displayPrice = product.minPrice ?? product.price ?? 0;
  const totalStock = product.totalStock ?? product.stock ?? 0;

  const isSealedProduct = sealed 
    || product.main_type === 'SEALED_PRODUCT' 
    || product.mainType === 'SEALED_PRODUCT' 
    || product.isSealed === true;

  return (
    <Link
      to={`/products/${product.slug || product.id}`}
      className="group relative flex flex-col w-full h-full rounded-2xl border border-ink-100 dark:border-white/10 bg-white dark:bg-ink-900/60 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      {/* 1. CONTAINER ẢNH VÀ BADGE TRÊN */}
      <div className="relative aspect-[3/4] w-full bg-ink-50 dark:bg-white/5 overflow-hidden p-3.5">
        <div className="absolute top-3 left-3 z-10">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md shadow-sm ${
              isSealedProduct
                ? 'bg-emerald-500 text-white'
                : 'bg-fuchsia-600 text-white'
            }`}
          >
            {isSealedProduct ? 'SEALED' : 'CARD'}
          </span>
        </div>

        <div className="w-full h-full rounded-xl overflow-hidden flex items-center justify-center">
          <ProductImage
            src={product.images?.[0] || product.image || product.front_image}
            alt={product.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            isSealed={isSealedProduct}
          />
        </div>
      </div>

      {/* 2. FOOTER CONTAINER (TÊN, GIÁ & BADGE TỒN KHO) */}
      <div className="flex flex-col justify-between flex-1 p-3.5 pt-1">
        {/* Tên sản phẩm */}
        <h3 className="font-medium text-sm text-strong line-clamp-2 min-h-[2.5rem] group-hover:text-primary-600 transition-colors">
          {product.name}
        </h3>

        {/* Khối Giá tiền & Badge tồn kho (Layout dồn hàng dọc thoáng đẹp) */}
        <div className="mt-2 flex flex-col items-start gap-1.5 w-full">
          {/* Dòng Giá tiền */}
          <span className="font-bold text-primary-600 dark:text-primary-400 text-sm sm:text-base truncate w-full">
            {formatVND(displayPrice)}
          </span>

          {/* Badge Tồn Kho xuống hàng riêng */}
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
            {totalStock} còn hàng
          </span>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;