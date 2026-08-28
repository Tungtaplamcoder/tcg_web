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
        primary: {
          50: '#f6f3ff',
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
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
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
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif']
      },
      letterSpacing: {
        tightest: '-0.04em'
      },
      boxShadow: {
        'card': '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px rgba(15, 23, 42, 0.06)',
        'card-hover': '0 12px 32px -8px rgba(76, 29, 149, 0.18), 0 4px 12px rgba(15, 23, 42, 0.06)',
        'glass': '0 8px 32px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        'glass-dark': '0 8px 40px -8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glow': '0 0 24px -4px rgba(139, 92, 246, 0.45)',
        'glow-lg': '0 8px 40px -8px rgba(217, 70, 239, 0.5)',
        'aura': '0 0 0 1px rgba(255,255,255,0.06), 0 0 40px -6px rgba(34,211,238,0.35), 0 0 70px -10px rgba(217,70,239,0.30)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.12)'
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #7c3aed 0%, #c026d3 55%, #f43f5e 120%)',
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
        }
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
        'tcg-float': 'tcg-float 7s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
