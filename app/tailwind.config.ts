import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.vue',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
  ],
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['emerald'],
  },
} satisfies Config
