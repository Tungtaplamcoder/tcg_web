import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import api from '../services/api';

/* ── Global site configuration context ─────────────────────────────────
    Single source of truth for site identity (browser tab title, favicon)
    and the external support chat link. Fetched once from
    GET /settings/public on app boot; the Admin "Shop Settings" page can
    push saved values in via updateSiteSettings() so every bound consumer
    (document.title, <link rel="icon">, floating chat anchor) updates
    instantly without a page reload. */

export const SITE_SETTING_KEYS = ['site_title', 'site_favicon_url', 'support_chat_url'];

export const SITE_DEFAULTS = {
  site_title: 'TCG Store',
  site_favicon_url: '',
  support_chat_url: 'https://m.me/1251937284677510'
};

/** Keep only the known site keys (drops API metadata such as `source`). */
export const pickSiteSettings = (data) =>
  SITE_SETTING_KEYS.reduce((acc, key) => {
    acc[key] = data && data[key] !== undefined && data[key] !== null ? data[key] : '';
    return acc;
  }, {});

/** Apply title + favicon to the document head. */
export const applySiteSettings = (data) => {
  if (data.site_title) {
    document.title = data.site_title;
  }
  if (data.site_favicon_url) {
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = data.site_favicon_url;
  }
};

const SiteContext = createContext({
  site: SITE_DEFAULTS,
  loading: true,
  updateSiteSettings: () => {},
  refreshSiteSettings: async () => {}
});

export const SiteProvider = ({ children }) => {
  const [site, setSite] = useState(SITE_DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refreshSiteSettings = useCallback(async () => {
    try {
      const response = await api.get('/settings/public');
      const data = pickSiteSettings(response.data.data);
      setSite(data);
      applySiteSettings(data);
    } catch (err) {
      console.error('Failed to load site settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSiteSettings();
  }, [refreshSiteSettings]);

  /**
   * Push freshly saved settings (e.g. from the Admin panel) into global
   * state. Accepts a full or partial site config; values fall back to the
   * previous state and then to the static defaults.
   */
  const updateSiteSettings = useCallback((data) => {
    if (!data || typeof data !== 'object') return;
    setSite((prev) => {
      const next = { ...SITE_DEFAULTS, ...prev, ...data };
      applySiteSettings(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ site, loading, updateSiteSettings, refreshSiteSettings }),
    [site, loading, updateSiteSettings, refreshSiteSettings]
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
};

export const useSiteSettings = () => useContext(SiteContext);
