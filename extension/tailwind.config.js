/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          light: '#f1f8e9',
          DEFAULT: '#86b817',
          dark: '#5a8208',
        }
      }
    },
  },
  plugins: [],
}
