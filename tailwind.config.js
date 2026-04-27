/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#f5f9ff',
        panel: '#0454a3',
        panelSoft: '#0a66c2',
        line: '#cfe0f5',
        accent: '#0077d4',
        accentSoft: '#00539b',
        brandSun: '#ffc928',
        brandWarm: '#ff9f1c',
        danger: '#ef4444',
        warning: '#f59e0b',
        success: '#22c55e',
      },
      fontFamily: {
        sans: ['Trebuchet MS', 'Segoe UI', 'Verdana', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 24px 60px rgba(4, 84, 163, 0.12)',
      },
      backgroundImage: {
        grid: 'radial-gradient(circle at 1px 1px, rgba(4,84,163,0.08) 1px, transparent 0)',
      },
    },
  },
  plugins: [],
};
