import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';

const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {}, setTheme: () => {} });

const STORAGE_KEY = 'tcg-theme';

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (e) { /* private mode */ }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

const syncMetaThemeColor = (theme) => {
  const meta = document.querySelector('meta[name="theme-color"]:not([media])') ||
    document.querySelector(`meta[name="theme-color"][media*="${theme}"]`);
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0a0a0f' : '#f6f5fb');
};

export const ThemeProvider = ({ children }) => {
  const [theme, setThemeState] = useState(getInitialTheme);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.style.colorScheme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) { /* no-op */ }
    syncMetaThemeColor(theme);
  }, [theme]);

  useEffect(() => {
    // Release the no-transition boot guard after first paint
    const id = window.setTimeout(() => {
      document.documentElement.classList.remove('theme-boot');
    }, 120);
    return () => window.clearTimeout(id);
  }, []);

  const applyTheme = useCallback((next) => {
    const root = document.documentElement;

    // Smooth cross-fade via View Transitions API when available
    if (
      typeof document.startViewTransition === 'function' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      document.startViewTransition(() => {
        root.classList.toggle('dark', next === 'dark');
        root.style.colorScheme = next;
      });
    } else {
      // CSS fallback: temporarily animate color-bearing properties
      root.classList.add('theme-animating');
      root.classList.toggle('dark', next === 'dark');
      root.style.colorScheme = next;
      window.setTimeout(() => root.classList.remove('theme-animating'), 600);
    }
    setThemeState(next);
  }, []);

  const setTheme = useCallback((next) => {
    if (next === themeRef.current) return;
    applyTheme(next);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    applyTheme(themeRef.current === 'dark' ? 'light' : 'dark');
  }, [applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
