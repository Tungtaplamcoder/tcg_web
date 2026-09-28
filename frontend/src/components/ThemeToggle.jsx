import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = ({ className = '', iconClassName = 'h-5 w-5' }) => {
  const { theme, toggleTheme } = useTheme();
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`relative p-2 rounded-full transition-colors duration-200
        text-slate-500 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-400
        hover:bg-purple-50/70 dark:hover:bg-purple-500/10
        focus-visible:ring-2 focus-visible:ring-purple-500/50 focus:outline-none ${className}`}
    >
      <span key={theme} className="block animate-tcg-scale-in" style={{ transformOrigin: 'center' }}>
        {theme === 'dark' ? <Sun className={iconClassName} /> : <Moon className={iconClassName} />}
      </span>
    </button>
  );
};

export default ThemeToggle;
