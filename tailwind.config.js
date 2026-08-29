/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        beige:    '#0f0f1a',
        charcoal: 'rgba(255,255,255,0.90)',
        physical: '#1D9E75',
        mental:   '#7F77DD',
        spiritual:'#D85A30',
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
        'fade-up-in': {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'soft-pulse':  'soft-pulse 2s ease-in-out infinite',
        'ring-breathe': 'ring-breathe 3s ease-in-out infinite',
        'fade-up-in':  'fade-up-in 0.55s ease-out forwards',
      },
    },
  },
  plugins: [],
}
