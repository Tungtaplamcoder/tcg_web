import { create } from 'zustand';

const CART_STORAGE_KEY = 'tcg_cart';
const CART_VERSION = 2;

const getStoredCart = () => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return [];
    const items = JSON.parse(stored);
    if (!Array.isArray(items)) return [];
    // Migration: cart cũ thiếu variantId (dựa vào productId) vẫn hoạt động nhờ
    // fallback bên backend, nhưng đánh dấu để ProductDetail có thể nâng cấp.
    return items.map((item) => ({
      ...item,
      variantId: item.variantId || null
    }));
  } catch {
    return [];
  }
};

const persist = (items) => {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  localStorage.setItem('tcg_cart_version', String(CART_VERSION));
};

export const useCartStore = create((set, get) => ({
  items: getStoredCart(),
  totalItems: 0,
  totalPrice: 0,

  // Recalculate totals whenever items change
  recalculateTotals: () => {
    const items = get().items;
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = items.reduce((sum, item) => sum + Number(item.price || 0) * item.quantity, 0);
    set({ totalItems, totalPrice });
  },

  addItem: (product, quantity = 1, variantId = null) => {
    const items = [...get().items];
    const existingIndex = items.findIndex(
      (item) => item.productId === product.id && item.variantId === variantId
    );

    if (existingIndex >= 0) {
      items[existingIndex].quantity += quantity;
    } else {
      items.push({
        productId: product.id,
        variantId,
        name: product.name,
        price: product.price,
        image: product.images?.[0] || '',
        quantity,
        maxStock: product.stockQuantity
      });
    }

    persist(items);
    set({ items });
    get().recalculateTotals();
  },

  removeItem: (productId, variantId = null) => {
    const items = get().items.filter(
      (item) => !(item.productId === productId && item.variantId === variantId)
    );
    persist(items);
    set({ items });
    get().recalculateTotals();
  },

  updateQuantity: (productId, quantity, variantId = null) => {
    const items = get().items.map((item) => {
      if (item.productId === productId && (item.variantId || null) === variantId) {
        return { ...item, quantity: Math.max(1, Math.min(quantity, item.maxStock || 10)) };
      }
      return item;
    });
    persist(items);
    set({ items });
    get().recalculateTotals();
  },

  clearCart: () => {
    localStorage.removeItem(CART_STORAGE_KEY);
    set({ items: [], totalItems: 0, totalPrice: 0 });
  },

  // This method can be called by product detail page to update price for accurate totals
  setItemPrice: (productId, price, variantId = null) => {
    const items = get().items.map((item) => {
      if (item.productId === productId && (item.variantId || null) === variantId) {
        return { ...item, price };
      }
      return item;
    });
    persist(items);
    set({ items });
    get().recalculateTotals();
  }
}));
