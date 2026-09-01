/**
 * config/env.js — single source of truth for runtime base URLs.
 *
 * Accepts BOTH Next-style NEXT_PUBLIC_* names (as requested) and this
 * codebase's native VITE_* names. Vite exposes any variable matching
 * the configured `envPrefix` (see vite.config.js — both prefixes are
 * enabled), so the same .env works for either convention:
 *
 *   NEXT_PUBLIC_APP_URL  (or VITE_APP_URL)   — public frontend origin
 *   NEXT_PUBLIC_API_URL  (or VITE_API_URL)   — backend API base
 *   NEXT_PUBLIC_SOCKET_URL (or VITE_SOCKET_URL) — Socket.io origin
 *
 * No hardcoded domains or IPs anywhere: in the standard production
 * topology (Nginx reverse proxy) API_URL stays a RELATIVE path so the
 * browser hits whatever host served the app; absolute values are used
 * only when the API genuinely lives on another origin.
 */

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

/** Public frontend origin — e.g. https://yourdomain.com */
export const APP_URL = trimTrailingSlash(
  import.meta.env.NEXT_PUBLIC_APP_URL || import.meta.env.VITE_APP_URL || ''
);

/**
 * API base — e.g. https://api.yourdomain.com or relative /api/v1.
 * Default: relative path through the Nginx reverse proxy (never a
 * hardcoded host), which keeps fetches same-origin under any domain.
 */
export const API_URL = trimTrailingSlash(
  import.meta.env.NEXT_PUBLIC_API_URL || import.meta.env.VITE_API_URL || '/api/v1'
);

/** Socket.io origin — empty string means "same origin as the page". */
export const SOCKET_URL = trimTrailingSlash(
  import.meta.env.NEXT_PUBLIC_SOCKET_URL || import.meta.env.VITE_SOCKET_URL || ''
);

/** Absolute URL for a frontend route, e.g. appUrl('/payment/success', {orderId}) */
export const appUrl = (path, params) => {
  const base = APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  if (!params) return url;
  const search = new URLSearchParams(params).toString();
  return search ? `${url}?${search}` : url;
};

export default { APP_URL, API_URL, SOCKET_URL, appUrl };
