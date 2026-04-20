/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
        },
        surface: {
          base: '#f5f5f7',
          panel: '#ffffff',
          hover: '#e8e8ed',
          active: '#dcdcde',
        },
        fg: {
          DEFAULT: '#1d1d1f',
          secondary: '#6e6e73',
          subtle: '#86868b',
          disabled: '#aeaeb2',
        },
        edge: {
          DEFAULT: '#d2d2d7',
          subtle: '#ebebed',
        },
        status: {
          backlog: '#86868b',
          todo: '#6e6e73',
          in_progress: '#2563eb',
          in_review: '#7c3aed',
          blocked: '#ea580c',
          done: '#16a34a',
          cancelled: '#aeaeb2',
        },
        priority: {
          urgent: '#ef4444',
          high: '#f97316',
          medium: '#eab308',
          low: '#86868b',
        },
      },
      boxShadow: {
        elevated: '0 12px 40px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
};
