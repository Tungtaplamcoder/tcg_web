import { create } from 'zustand';
import api from '../services/api';

// Helper to safely parse JSON from localStorage
const getStoredItem = (key) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
};

const setStoredItem = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Failed to store in localStorage', e);
  }
};

const removeStoredItem = (key) => {
  localStorage.removeItem(key);
};

// Hard-purge every persisted auth artifact. Used by the global 401 handler
// (api.js) and logout so a deleted/expired account can never leave a stale
// profile behind in localStorage/sessionStorage.
const purgeStoredAuth = () => {
  removeStoredItem('tcg_access_token');
  removeStoredItem('tcg_refresh_token');
  removeStoredItem('tcg_user');
  try {
    sessionStorage.clear();
  } catch {
    /* sessionStorage unavailable (private mode) — best effort */
  }
};

const initialUser = getStoredItem('tcg_user');
const initialAccessToken = getStoredItem('tcg_access_token');
const initialRefreshToken = getStoredItem('tcg_refresh_token');

export const useAuthStore = create((set) => ({
  user: initialUser,
  accessToken: initialAccessToken,
  refreshToken: initialRefreshToken,
  isAuthenticated: !!(initialAccessToken && initialUser),
  isLoading: false,

  setTokens: (accessToken, refreshToken, user) => {
    setStoredItem('tcg_access_token', accessToken);
    setStoredItem('tcg_refresh_token', refreshToken);
    setStoredItem('tcg_user', user);
    set({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: true,
      isLoading: false
    });
  },

  login: async (identifier, password) => {
    // Phone is the primary identifier; email is optional on accounts.
    const trimmed = (identifier || '').trim();
    const payload = trimmed.includes('@')
      ? { email: trimmed, password }
      : { phone: trimmed, password };
    set({ isLoading: true });
    try {
      const response = await api.post('/auth/login', payload);
      const { user, accessToken, refreshToken } = response.data.data;
      setStoredItem('tcg_access_token', accessToken);
      setStoredItem('tcg_refresh_token', refreshToken);
      setStoredItem('tcg_user', user);
      set({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false
      });
      return { success: true, user };
    } catch (error) {
      // Capture full detail for debugging (status + server message + body)
      const status = error.response?.status;
      const serverMessage = error.response?.data?.error?.message;
      const rawBody = error.response?.data;
      console.error('[LOGIN] error', {
        status,
        serverMessage,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        rawBody
      });
      set({ isLoading: false });
      // Prefer the server's message; fall back to a clear network error hint
      const message =
        serverMessage ||
        (error.code === 'ERR_NETWORK'
          ? 'Network error: cannot reach the API (check API URL / CORS / firewall)'
          : 'Login failed');
      return { success: false, error: message, status, rawBody };
    }
  },

  register: async (userData) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/auth/register', userData);
      const { user, accessToken, refreshToken } = response.data.data;
      setStoredItem('tcg_access_token', accessToken);
      setStoredItem('tcg_refresh_token', refreshToken);
      setStoredItem('tcg_user', user);
      set({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false
      });
      return { success: true, user };
    } catch (error) {
      set({ isLoading: false });
      const fieldErrors = error.response?.data?.errors;
      return {
        success: false,
        error: error.response?.data?.error?.message || 'Registration failed',
        errors: fieldErrors && typeof fieldErrors === 'object' ? fieldErrors : null
      };
    }
  },

  logout: async () => {
    try {
      const { refreshToken } = useAuthStore.getState();
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      purgeStoredAuth();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  },

  // Synchronous, side-effect-free auth reset. Safe to call from the axios
  // interceptor (never issues another request, so it cannot recurse).
  clearAuth: () => {
    purgeStoredAuth();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false
    });
  },

  // Verify the persisted session against the backend on app bootstrap. A
  // deleted account returns 401 ("Account no longer exists") and this clears
  // the store so the Topbar instantly reverts to the "Đăng nhập" state.
  validateSession: async () => {
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) {
      useAuthStore.getState().clearAuth();
      return false;
    }
    try {
      const response = await api.get('/auth/me');
      const freshUser = response.data?.data;
      if (freshUser && freshUser.id) {
        setStoredItem('tcg_user', freshUser);
        set({ user: freshUser, isAuthenticated: true });
        return true;
      }
      useAuthStore.getState().clearAuth();
      return false;
    } catch (error) {
      // The 401 interceptor already force-logs-out; mirror it defensively.
      useAuthStore.getState().clearAuth();
      return false;
    }
  },

  updateUser: (user) => {
    setStoredItem('tcg_user', user);
    set({ user });
  }
}));