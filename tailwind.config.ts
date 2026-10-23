import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12202B',
        river: { DEFAULT: '#0B5D55', dark: '#083F3A', soft: '#E3F0ED' },
        sun: { DEFAULT: '#F0B429', dark: '#B7860F' },
        clay: '#B8432F',
        mist: '#F3F5F4',
        line: '#DCE2E0',
        muted: '#51626E',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config