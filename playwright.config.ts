import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:5173' },
  projects: [
    { name: 'ноутбук', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'телефон', use: { viewport: { width: 844, height: 390 } } },
  ],
})
