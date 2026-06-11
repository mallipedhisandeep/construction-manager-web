import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        // UX-2 fix: was 'DM Sans' but DM Sans was never imported in globals.css.
        // Changed to 'Inter' which IS imported, so font-body class works correctly.
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        accent: {
          DEFAULT: '#d48c28',
          light: '#f0b040',
          dark: '#9a6010',
        }
      },
      borderWidth: { '3': '3px' },
    }
  },
  plugins: [],
}
export default config
