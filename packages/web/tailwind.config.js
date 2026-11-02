/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'rayban': {
          50: '#f8f9fa',
          100: '#f1f3f5',
          500: '#495057',
          900: '#212529',
        },
      },
    },
  },
  plugins: [],
}
