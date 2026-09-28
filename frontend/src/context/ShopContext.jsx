import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import api from '../services/api';

/* ── Global shop configuration context ─────────────────────────────────
    Single source of truth for shop identity (name, logo) and support
    contact info. Fetched once from GET /shop-info on app boot; the Admin
    "Shop Settings" page pushes saved values in via updateShopInfo() so
    every bound consumer (Navbar brand, Footer contact block, ...) re-renders
    instantly without a page reload or per-component refetch. */

export const SHOP_SETTING_KEYS = [
  'shop_name',
  'shop_logo_url',
  'support_email',
  'support_phone',
  'support_address'
];

export const SHOP_DEFAULTS = {
  shop_name: 'TCG Store',
  shop_logo_url: '',
  support_email: 'support@tcgstore.com',
  support_phone: '+84 123 456 789',
  support_address: '123 Main St, Hanoi, Vietnam'
};

/** Keep only the known shop keys (drops API metadata such as `source`). */
export const pickShopSettings = (data) =>
  SHOP_SETTING_KEYS.reduce((acc, key) => {
    acc[key] = data && data[key] !== undefined && data[key] !== null ? data[key] : '';
    return acc;
  }, {});

const ShopContext = createContext({
  shop: null,
  loading: true,
  error: '',
  updateShopInfo: () => {},
  refreshShopInfo: async () => {}
});

export const ShopProvider = ({ children }) => {
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshShopInfo = useCallback(async () => {
    try {
      const response = await api.get('/shop-info');
      setShop(response.data.data || null);
      setError('');
    } catch (err) {
      console.error('Failed to load shop info:', err);
      setError(err?.message || 'Failed to load shop info');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshShopInfo();
  }, [refreshShopInfo]);

  /**
   * Push freshly saved settings (e.g. from the Admin panel) into global
   * state. Accepts a full or partial shop config; values fall back to the
   * previous state and then to the static defaults.
   */
  const updateShopInfo = useCallback((data) => {
    if (!data || typeof data !== 'object') return;
    setShop((prev) => ({ ...SHOP_DEFAULTS, ...(prev || {}), ...data }));
  }, []);

  const value = useMemo(
    () => ({ shop, loading, error, updateShopInfo, refreshShopInfo }),
    [shop, loading, error, updateShopInfo, refreshShopInfo]
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
};

export const useShop = () => useContext(ShopContext);
