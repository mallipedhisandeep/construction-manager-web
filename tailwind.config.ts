import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#d48c28',
          light: '#f0b040',
          dark: '#9a6010',
          steel: '#1a2540',
        }
      }
    }
  },
  plugins: [],
}
export default config
