module.exports = {
  content: ['./client/src/**/*.{js,jsx,ts,tsx,html}'],
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
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out forwards',
        'modal-open': 'modalOpen 0.2s ease-out forwards',
        'panel-slide': 'panelSlide 0.25s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        modalOpen: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        panelSlide: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
