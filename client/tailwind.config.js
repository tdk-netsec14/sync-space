/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx,ts,tsx,html}', './index.html'],
  theme: {
    extend: {
      colors: {
        sidebar: '#0f172a',
        'sidebar-hover': '#1e293b',
        'sidebar-active': '#334155',
        content: '#f8fafc',
        card: '#ffffff',
        border: '#e2e8f0',
        primary: '#6366f1',
        'primary-dark': '#4f46e5',
        'primary-light': '#eef2ff',
        'text-primary': '#0f172a',
        'text-muted': '#64748b',
        'text-faint': '#94a3b8',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
        urgent: '#ef4444',
        high: '#f97316',
        medium: '#f59e0b',
        low: '#6366f1',
        // Wix Editorial SaaS Palette
        brand: {
          yellow: '#F4C318',
          lavender: '#DCC7FF',
          purple: '#8B5CF6',
          beige: '#F6EFD8',
          offwhite: '#F8F8F5',
          black: '#111111',
          navy: '#0F172A'
        },
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          650: '#4338ca',
          700: '#3730a3',
          750: '#2e278f',
          800: '#1e1b4b',
          900: '#312e81',
          950: '#1e1b4b'
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          450: '#7a8a9e',
          500: '#64748b',
          600: '#475569',
          650: '#384252',
          700: '#334155',
          800: '#1e293b',
          850: '#151e2e',
          900: '#0f172a',
          950: '#020617'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        editorial: ['Clash Display', 'sans-serif'],
        'sans-editorial': ['General Sans', 'sans-serif'],
        'serif-editorial': ['Instrument Serif', 'serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.25s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'modal-open': 'modalOpen 0.2s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'panel-slide': 'panelSlide 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        modalOpen: {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        panelSlide: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' }
        }
      }
    }
  },
  plugins: []
};
