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

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const response = await api.post('/auth/login', { email, password });
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
      return { success: false, error: error.response?.data?.error?.message || 'Login failed' };
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
      return { success: false, error: error.response?.data?.error?.message || 'Registration failed' };
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
      removeStoredItem('tcg_access_token');
      removeStoredItem('tcg_refresh_token');
      removeStoredItem('tcg_user');
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false
      });
    }
  },

  updateUser: (user) => {
    setStoredItem('tcg_user', user);
    set({ user });
  }
}));