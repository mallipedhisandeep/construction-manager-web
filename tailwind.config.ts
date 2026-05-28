import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#ea580c', light: '#fed7aa', dark: '#9a3412' }
      }
    }
  },
  plugins: [],
}
export default config
