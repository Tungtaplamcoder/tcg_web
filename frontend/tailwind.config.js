/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        /* Pastel editorial accent — soft pink → deep rose.
           400 (#F472B6) is the soft accent, 600 (#E11D48) the strong one. */
        primary: {
          50: '#fff1f4',
          100: '#ffe4ea',
          200: '#fecdd8',
          300: '#fda4ba',
          400: '#f472b6',
          500: '#ec4899',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
          950: '#4c0519'
        },
        /* Soft blush pink — backgrounds, badges and washed panels */
        blush: {
          50: '#fff7fa',
          100: '#fff0f5',
          200: '#ffe4ef',
          300: '#ffd0e4',
          400: '#fbb6ce',
          500: '#f472b6',
          600: '#db2777',
          700: '#be185d'
        },
        /* Warm editorial paper */
        cream: {
          DEFAULT: '#fdfbf7',
          50: '#fefdfb',
          100: '#fdfbf7',
          200: '#f8f3ec',
          300: '#f1e9de'
        },
        secondary: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
          950: '#2e1065'
        },
        accent: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e'
        },
        /* Warm neutral ink — pairs with cream/blush paper instead of cold slate */
        ink: {
          50: '#faf9f7',
          100: '#f4f1ec',
          200: '#e8e2da',
          300: '#d6cec4',
          400: '#a89f95',
          500: '#78706a',
          600: '#57504b',
          700: '#3f3936',
          800: '#2a2523',
          900: '#1c1917',
          950: '#120f0e'
        },
        obsidian: {
          50: '#16161f',
          100: '#121219',
          200: '#0e0e16',
          300: '#0a0a0f',
          400: '#07070b',
          500: '#040407'
        },
        aura: {
          cyan: '#22d3ee',
          gold: '#e9c46a',
          violet: '#8b5cf6',
          magenta: '#d946ef'
        },
        canvas: 'var(--bg-app)',
        'canvas-2': 'var(--bg-app-2)',
        surface: 'var(--bg-surface)',
        'surface-2': 'var(--bg-surface-2)',
        pop: 'var(--bg-pop)',
        strong: 'var(--text-strong)',
        muted: 'var(--text-muted)',
        faint: 'var(--text-faint)',
        edge: 'var(--border-subtle)',
        brand: 'var(--accent)'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        /* Editorial serif accent — Playfair Display ships a Vietnamese
           subset, so italic focus words keep their diacritics intact. */
        serif: ['"Playfair Display"', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        /* script: editorial italic focus words ("We're", "Real") */
        script: ['"Playfair Display"', 'Georgia', 'Cambria', 'serif']
      },
      letterSpacing: {
        tightest: '-0.04em'
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(120, 80, 90, 0.04), 0 6px 20px -8px rgba(225, 29, 72, 0.10)',
        'soft-lg': '0 10px 34px -12px rgba(225, 29, 72, 0.18), 0 4px 12px rgba(120, 80, 90, 0.06)',
        'card': '0 1px 2px rgba(120, 80, 90, 0.04), 0 4px 16px rgba(120, 80, 90, 0.06)',
        'card-hover': '0 12px 32px -8px rgba(225, 29, 72, 0.16), 0 4px 12px rgba(120, 80, 90, 0.06)',
        'glass': '0 8px 32px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        'glass-dark': '0 8px 40px -8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glow': '0 0 24px -4px rgba(139, 92, 246, 0.45)',
        'glow-lg': '0 8px 40px -8px rgba(217, 70, 239, 0.5)',
        'aura': '0 0 0 1px rgba(255,255,255,0.06), 0 0 40px -6px rgba(34,211,238,0.35), 0 0 70px -10px rgba(217,70,239,0.30)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.12)'
      },
      backgroundImage: {
        /* Soft pastel mesh overlays — transparent base so the app canvas
           gradient flows seamlessly behind the transparent header (no hard
           rectangular block boundary at the top of the page). */
        'mesh-editorial':
          'radial-gradient(60% 55% at 12% 8%, rgba(244, 114, 182, 0.16), transparent 62%), radial-gradient(50% 50% at 88% 4%, rgba(225, 29, 72, 0.10), transparent 60%), radial-gradient(55% 60% at 55% 100%, rgba(255, 208, 228, 0.42), transparent 70%)',
        'mesh-editorial-dark':
          'radial-gradient(60% 55% at 12% 8%, rgba(225, 29, 72, 0.20), transparent 62%), radial-gradient(50% 50% at 88% 4%, rgba(244, 114, 182, 0.14), transparent 60%), radial-gradient(55% 60% at 55% 100%, rgba(120, 20, 50, 0.30), transparent 70%)',
        'brand-gradient': 'linear-gradient(135deg, #e11d48 0%, #ec4899 55%, #f472b6 120%)',
        'brand-gradient-soft': 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(217,70,239,0.08))',
        'radial-fade': 'radial-gradient(80% 80% at 50% 0%, rgba(139,92,246,0.12), transparent)',
        'iridescent': 'linear-gradient(120deg, #22d3ee 0%, #8b5cf6 30%, #d946ef 55%, #e9c46a 80%, #22d3ee 100%)',
        'holo-sheen': 'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.55) 38%, rgba(168,85,247,0.35) 48%, rgba(34,211,238,0.35) 56%, rgba(255,255,255,0.5) 64%, transparent 82%)'
      },
      keyframes: {
        'foil-shimmer': {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '200% 200%' }
        },
        'holo-rotate': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        },
        'aura-pulse': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.12)' }
        },
        'metallic-sweep': {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '100%': { transform: 'translateX(220%) skewX(-18deg)' }
        },
        'parallax-float': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) rotateX(var(--rx, 8deg)) rotateY(var(--ry, -12deg))' },
          '50%': { transform: 'translate3d(0, -18px, 0) rotateX(var(--rx, 8deg)) rotateY(var(--ry, -12deg))' }
        },
        'reveal-up': {
          'from': { opacity: '0', transform: 'translateY(16px)' },
          'to': { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          'from': { opacity: '0', transform: 'scale(0.96) translateY(8px)' },
          'to': { opacity: '1', transform: 'scale(1) translateY(0)' }
        },
        'fade-in': {
          'from': { opacity: '0' },
          'to': { opacity: '1' }
        },
        'tcg-float': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(0, -22px, 0) scale(1.06)' }
        },
        'tcg-bob': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, -6px, 0)' }
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-5px)' },
          '40%': { transform: 'translateX(5px)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(3px)' }
        },
        'marquee': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        }
      },
      backdropBlur: {
        xs: '2px'
      },
      animation: {
        'foil-shimmer': 'foil-shimmer 6s linear infinite',
        'holo-rotate': 'holo-rotate 18s linear infinite',
        'aura-pulse': 'aura-pulse 3s ease-in-out infinite',
        'metallic-sweep': 'metallic-sweep 2.6s ease-in-out infinite',
        'parallax-float': 'parallax-float 7s ease-in-out infinite',
        'reveal-up': 'reveal-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.2s ease-out both',
        'tcg-float': 'tcg-float 7s ease-in-out infinite',
        'tcg-bob': 'tcg-bob 3.4s ease-in-out infinite',
        'shake': 'shake 0.4s ease-in-out both',
        'marquee': 'marquee 28s linear infinite'
      }
    }
  },
  plugins: []
};
