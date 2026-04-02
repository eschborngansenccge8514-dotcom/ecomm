/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb', // Core Primary
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        success: '#10b981', // Emerald
        warning: '#f59e0b', // Amber
        danger:  '#ef4444', // Red
        gray: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        }
      },
      fontFamily: {
        heading: ['Outfit_700Bold', 'System'],
        sans: ['Outfit_400Regular', 'System'],
        medium: ['Outfit_500Medium', 'System'],
        semibold: ['Outfit_600SemiBold', 'System'],
        bold: ['Outfit_700Bold', 'System'],
        mono: ['monospace'],
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.05)',
        'soft': '0 8px 24px rgba(149, 157, 165, 0.08)',
        'heavy': '0 20px 40px rgba(0, 0, 0, 0.08)',
      }
    },
  },
  plugins: [],
};
