/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sora', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d7fd',
          300: '#a5bbfb',
          400: '#8196f8',
          500: '#6272f3',
          600: '#4b52e8',
          700: '#3d42d0',
          800: '#3338a8',
          900: '#2e3285',
        },
        accent: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea6c0c',
        },
        surface: {
          50: '#f8f9fe',
          100: '#f1f3fd',
          200: '#e4e8fa',
          800: '#1e2140',
          900: '#141629',
          950: '#0c0e1f',
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
      }
    },
  },
  plugins: [],
}
