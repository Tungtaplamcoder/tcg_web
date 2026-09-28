import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { TRANSLATIONS as DICTS } from './translations';
// vi is also the fallback dictionary when a key is missing in the
// active language.
const vi = DICTS.vi;

/* ── Lightweight i18n context (no external deps) ─────────────────────────
    - Active language persisted in localStorage ('tcg-lang'), default 'vi'.
    - t('a.b.key', { token }) resolves nested dictionary keys with
      {token} interpolation; missing keys fall back to vi, then to the
      raw key so gaps are visible instead of blank.
    - Dictionaries are static modules — switching languages only swaps
      the context value, so every consumer re-renders instantly. */

const STORAGE_KEY = 'tcg-lang';
export const LANGUAGES = [
  { code: 'vi', label: 'VI', name: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'EN', name: 'English', flag: '🇺🇸' }
];

const getInitialLanguage = () => {
  if (typeof window === 'undefined') return 'vi';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'vi' || stored === 'en') return stored;
  } catch (e) { /* private mode */ }
  return 'vi';
};

const resolveKey = (dict, key) =>
  key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), dict);

const interpolate = (text, params) => {
  if (!params || typeof text !== 'string') return text;
  return text.replace(/\{(\w+)\}/g, (match, token) =>
    Object.prototype.hasOwnProperty.call(params, token) ? String(params[token]) : match);
};

export const translate = (language, key, params) => {
  let text = resolveKey(DICTS[language], key);
  if (text === undefined) text = resolveKey(DICTS.vi, key);
  if (text === undefined) return key;
  return interpolate(text, params);
};

const LanguageContext = createContext({
  language: 'vi',
  setLanguage: () => {},
  toggleLanguage: () => {},
  t: (key, params) => translate('vi', key, params)
});

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(getInitialLanguage);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, language); } catch (e) { /* no-op */ }
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next) => {
    if (next === 'vi' || next === 'en') setLanguageState(next);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((prev) => (prev === 'vi' ? 'en' : 'vi'));
  }, []);

  const t = useCallback(
    (key, params) => translate(language, key, params),
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, setLanguage, toggleLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => useContext(LanguageContext);
