import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#e8f0fb',
          100: '#bdd7ee',
          600: '#2e75b6',
          700: '#1f5c99',
          800: '#1f3864',
          900: '#0f1f38',
        },
      },
    },
  },
  plugins: [],
}
export default config
