import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = ({ className = '', iconClassName = 'h-[20px] w-[20px]' }) => {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`relative p-2.5 rounded-full overflow-hidden transition-all duration-300
        text-ink-500 hover:text-primary-700 hover:bg-primary-50
        dark:text-ink-300 dark:hover:text-aura-gold dark:hover:bg-white/10
        focus-visible:ring-2 focus-visible:ring-primary-500/50 ${className}`}
    >
      <span key={theme} className="block animate-tcg-scale-in" style={{ transformOrigin: 'center' }}>
        {theme === 'dark' ? <Sun className={iconClassName} /> : <Moon className={iconClassName} />}
      </span>
    </button>
  );
};

export default ThemeToggle;
