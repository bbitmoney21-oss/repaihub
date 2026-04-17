/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1C2C',
          mid: '#132233',
          soft: '#1C3147',
          deep: '#071420',
        },
        gold: {
          DEFAULT: '#C9963A',
          light: '#E8B86D',
          pale: '#F5E6C8',
        },
        cream: '#FAF6F0',
        muted: '#8BA0B4',
        success: '#27AE60',
        danger: '#E74C3C',
        warning: '#F39C12',
      },
      fontFamily: {
        head: ['Cormorant Garamond', 'Georgia', 'serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease forwards',
        'fade-in': 'fadeIn 0.4s ease forwards',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
