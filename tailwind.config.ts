import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
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
