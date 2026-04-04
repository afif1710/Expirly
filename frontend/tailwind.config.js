/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#f4f7f4',
          100: '#e8f0e8',
          200: '#d1e0d1',
          300: '#adc6ad',
          400: '#82a684',
          500: '#6b8f6e',
          600: '#537256',
          700: '#435c45',
          800: '#384a3a',
          900: '#2e3e30',
          950: '#172119',
        },
        cream: {
          50: '#fafbf9',
          100: '#f5f7f3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
