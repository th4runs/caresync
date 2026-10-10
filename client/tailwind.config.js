/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dcebfe',
          200: '#bcd8fc',
          300: '#8dbdf8',
          400: '#4f97f1',
          500: '#2a7de9',
          600: '#1669d6',
          700: '#1255b0',
          800: '#13478e',
          900: '#153d74',
        },
        ink: {
          DEFAULT: '#12223f',
          soft: '#47546b',
          muted: '#6b768a',
        },
        line: '#e4e9f0',
        canvas: '#f5f7fa',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 34, 63, 0.04), 0 1px 3px rgba(16, 34, 63, 0.04)',
        pop: '0 10px 30px -8px rgba(16, 34, 63, 0.18)',
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
};
