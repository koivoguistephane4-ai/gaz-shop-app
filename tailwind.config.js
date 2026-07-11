/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#131E29',
          900: '#1B2A3A',
          800: '#243B50',
          700: '#3D5A73',
        },
        flame: {
          500: '#E8871E',
          600: '#D0730F',
          100: '#FBE4C6',
        },
        gas: {
          bg: '#EEF1F3',
          card: '#FFFFFF',
          line: '#DDE3E8',
          text: '#1B2A3A',
          muted: '#5A6B7A',
          success: '#4A9B6E',
          danger: '#C6493F',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '10px',
      }
    },
  },
  plugins: [],
}
