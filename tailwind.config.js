/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        beige: '#F5F0E8',
        charcoal: '#2C2C2A',
        physical: '#1D9E75',
        mental: '#7F77DD',
        spiritual: '#D85A30',
      },
      fontFamily: {
        serif: ['Lora', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'soft-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.03)' },
        },
        'ring-breathe': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },
      animation: {
        'soft-pulse': 'soft-pulse 2s ease-in-out infinite',
        'ring-breathe': 'ring-breathe 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
