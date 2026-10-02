import { create } from 'zustand';

/* ── Saved shipping addresses ────────────────────────────────────────────
    Shopee-style address book: users save addresses once in their profile
    menu and pick one during checkout (1-click fill).

    Persistence: localStorage, namespaced per user id so two accounts
    sharing a browser can never leak addresses into each other's picker.
    Shape of a saved address:
      {
        id, fullName, phone,
        provinceCode, provinceName,
        wardCode, wardName,
        addressLine1,      // specific street (số nhà, đường…)
        isDefault,         // exactly one default per user
        createdAt
      }
    The store also owns the global "manager modal" open flag so the
    profile dropdown can open the same modal mounted in the layout. */

const STORAGE_PREFIX = 'tcg_addresses_';
const storageKey = (userId) => `${STORAGE_PREFIX}${userId || 'guest'}`;

const readAddresses = (userId) => {
  if (typeof window === 'undefined' || !userId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAddresses = (userId, addresses) => {
  if (typeof window === 'undefined' || !userId) return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(addresses));
  } catch (e) {
    console.error('Failed to persist addresses', e);
  }
};

const makeId = () =>
  `addr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const normalize = (data, fallback = {}) => ({
  fullName: (data.fullName ?? fallback.fullName ?? '').trim(),
  phone: (data.phone ?? fallback.phone ?? '').trim(),
  provinceCode: data.provinceCode ?? fallback.provinceCode ?? '',
  provinceName: data.provinceName ?? fallback.provinceName ?? '',
  wardCode: data.wardCode ?? fallback.wardCode ?? '',
  wardName: data.wardName ?? fallback.wardName ?? '',
  addressLine1: (data.addressLine1 ?? fallback.addressLine1 ?? '').trim()
});

export const useAddressStore = create((set, get) => ({
  userId: null,
  addresses: [],
  isManagerOpen: false,

  // Bind the active user — reloads that user's saved address book.
  setUser: (userId) => {
    const nextId = userId || null;
    if (get().userId === nextId) return;
    set({ userId: nextId, addresses: readAddresses(nextId) });
  },

  openManager: () => set({ isManagerOpen: true }),
  closeManager: () => set({ isManagerOpen: false }),

  getDefaultAddress: () => {
    const list = get().addresses;
    return list.find((a) => a.isDefault) || list[0] || null;
  },

  addAddress: (data) => {
    const { userId, addresses } = get();
    const isFirst = addresses.length === 0;
    const makeDefault = Boolean(data.isDefault) || isFirst;
    const entry = {
      id: makeId(),
      ...normalize(data),
      isDefault: makeDefault,
      createdAt: Date.now()
    };
    const next = (makeDefault ? addresses.map((a) => ({ ...a, isDefault: false })) : addresses).concat(entry);
    writeAddresses(userId, next);
    set({ addresses: next });
    return entry;
  },

  updateAddress: (id, data) => {
    const { userId, addresses } = get();
    const makeDefault = Boolean(data.isDefault);
    const next = addresses.map((a) => {
      if (a.id === id) {
        return { ...a, ...normalize(data, a), isDefault: makeDefault || a.isDefault };
      }
      return makeDefault ? { ...a, isDefault: false } : a;
    });
    writeAddresses(userId, next);
    set({ addresses: next });
  },

  deleteAddress: (id) => {
    const { userId, addresses } = get();
    const removed = addresses.find((a) => a.id === id);
    let next = addresses.filter((a) => a.id !== id);
    // Never leave the book without a default when addresses remain.
    if (removed?.isDefault && next.length > 0 && !next.some((a) => a.isDefault)) {
      next = next.map((a, idx) => (idx === 0 ? { ...a, isDefault: true } : a));
    }
    writeAddresses(userId, next);
    set({ addresses: next });
  },

  setDefault: (id) => {
    const { userId, addresses } = get();
    const next = addresses.map((a) => ({ ...a, isDefault: a.id === id }));
    writeAddresses(userId, next);
    set({ addresses: next });
  }
}));
