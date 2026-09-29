import React from 'react';
import { useLanguage, LANGUAGES } from '../i18n/LanguageContext';

/* ── LanguageToggle — compact VI | EN segment control ──────────────────
    Minimalist two-segment pill (bg-slate-100/dark:slate-800, p-1,
    rounded-lg, text-xs font-semibold). The active segment inverts to
    solid slate-900/white with a short slide; the inactive segment stays
    muted. One tap toggles VI ⇄ EN — no dropdown for a two-language site.
    Compact 64px width keeps it tidy in the navbar utility group. */

const LanguageToggle = ({ className = '' }) => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      title={t('common.language')}
      className={`relative flex items-center bg-primary-50/80 dark:bg-white/5 p-1 rounded-full ring-1 ring-inset ring-primary-100 dark:ring-white/10 ${className}`}
    >
      {/* Sliding active thumb */}
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-full bg-gradient-to-r from-primary-600 to-primary-400 shadow-soft transition-[left] duration-300 ease-out"
        style={{ left: language === 'en' ? 'calc(50% + 0rem)' : '0.25rem' }}
      />
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          onClick={() => setLanguage(lang.code)}
          aria-pressed={language === lang.code}
          className={`relative z-10 flex items-center justify-center min-w-[28px] h-6 px-2 rounded-full text-xs font-semibold tracking-wide select-none transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 ${
            language === lang.code
              ? 'text-white'
              : 'text-ink-500 dark:text-ink-300 hover:text-primary-700 dark:hover:text-primary-300'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
};

export default LanguageToggle;
