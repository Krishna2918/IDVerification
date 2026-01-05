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
          50: '#F7F8FA',
          100: '#E8EBF0',
          200: '#C5CCE0',
          300: '#9AA8C9',
          400: '#4A90E2',
          500: '#1E73BE',
          600: '#103A8B',
          700: '#0A2A66',
          800: '#071D4A',
          900: '#041230',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
