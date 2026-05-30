/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ka: {
          green:     '#A8C300',
          'green-dark': '#86A000',
          'green-light': '#D4E680',
          orange:    '#FF6500',
          'orange-light': '#FFE0CC',
          gray: {
            50:  '#F5F5F5',
            100: '#EBEBEB',
            200: '#D4D4D4',
            400: '#9A9A9A',
            600: '#666666',
            700: '#333333',
            900: '#1A1A1A',
          }
        }
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
