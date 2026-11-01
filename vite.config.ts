import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// На GitHub Pages сайт лежит в подпапке /semester_schedule/; локально и в тестах — в корне
const base = process.env.GITHUB_PAGES === '1' ? '/semester_schedule/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
})
