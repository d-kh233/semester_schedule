import { expect, test } from '@playwright/test'

test('сайт открывается и показывает заголовок', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Планировщик семестра' })).toBeVisible()
})
