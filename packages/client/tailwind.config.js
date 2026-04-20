/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
        },
        surface: {
          base: 'var(--color-surface-base)',
          panel: 'var(--color-surface-panel)',
          hover: 'var(--color-surface-hover)',
          active: 'var(--color-surface-active)',
        },
        fg: {
          DEFAULT: 'var(--color-fg)',
          secondary: 'var(--color-fg-secondary)',
          subtle: 'var(--color-fg-subtle)',
          disabled: 'var(--color-fg-disabled)',
        },
        edge: {
          DEFAULT: 'var(--color-edge)',
          subtle: 'var(--color-edge-subtle)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
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
        elevated: 'var(--shadow-elevated)',
      },
    },
  },
  plugins: [],
};
