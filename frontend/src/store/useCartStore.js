import { create } from 'zustand';

const CART_STORAGE_KEY = 'tcg_cart';

const getStoredCart = () => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const useCartStore = create((set, get) => ({
  items: getStoredCart(),
  totalItems: 0,
  totalPrice: 0,

  // Recalculate totals whenever items change
  recalculateTotals: () => {
    const items = get().items;
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    // totalPrice will be calculated based on product price if available; otherwise we need product data.
    // We'll just store items, and totalPrice can be updated by components via setItemPrice.
    set({ totalItems });
  },

  addItem: (product, quantity = 1, cardId = null) => {
    const items = [...get().items];
    const existingIndex = items.findIndex(
      (item) => item.productId === product.id && item.cardId === cardId
    );

    if (existingIndex >= 0) {
      items[existingIndex].quantity += quantity;
    } else {
      items.push({
        productId: product.id,
        cardId,
        name: product.name,
        price: product.price,
        image: product.images?.[0] || '',
        quantity,
        maxStock: product.stockQuantity
      });
    }

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    set({ items });
    get().recalculateTotals();
  },

  removeItem: (productId, cardId = null) => {
    const items = get().items.filter(
      (item) => !(item.productId === productId && item.cardId === cardId)
    );
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    set({ items });
    get().recalculateTotals();
  },

  updateQuantity: (productId, quantity, cardId = null) => {
    const items = get().items.map((item) => {
      if (item.productId === productId && item.cardId === cardId) {
        return { ...item, quantity: Math.max(1, Math.min(quantity, item.maxStock || 10)) };
      }
      return item;
    });
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    set({ items });
    get().recalculateTotals();
  },

  clearCart: () => {
    localStorage.removeItem(CART_STORAGE_KEY);
    set({ items: [], totalItems: 0, totalPrice: 0 });
  },

  // This method can be called by product detail page to update price for accurate totals
  setItemPrice: (productId, price, cardId = null) => {
    const items = get().items.map((item) => {
      if (item.productId === productId && item.cardId === cardId) {
        return { ...item, price };
      }
      return item;
    });
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    set({ items });
    get().recalculateTotals();
  }
}));