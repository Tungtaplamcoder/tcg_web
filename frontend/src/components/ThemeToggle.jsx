import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n/LanguageContext';

const ThemeToggle = ({ className = '', iconClassName = 'h-5 w-5' }) => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const label = theme === 'dark' ? t('common.switchToLight') : t('common.switchToDark');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`relative p-2 rounded-full transition-colors duration-200
        text-ink-500 dark:text-ink-300 hover:text-primary-600 dark:hover:text-primary-400
        hover:bg-primary-50/70 dark:hover:bg-primary-400/10
        focus-visible:ring-2 focus-visible:ring-primary-400/50 focus:outline-none ${className}`}
    >
      <span key={theme} className="block animate-tcg-scale-in" style={{ transformOrigin: 'center' }}>
        {theme === 'dark' ? <Sun className={iconClassName} /> : <Moon className={iconClassName} />}
      </span>
    </button>
  );
};

export default ThemeToggle;
