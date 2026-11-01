import { expect, test, type Locator, type Page } from '@playwright/test'
import { openList } from './helpers.js'

// «Сегодня» подставляется явно: 31.10.2026 (суббота)
async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
  await openList(page)
}

const input = (page: Page) => page.getByRole('textbox', { name: 'Строка ввода' })
const eventRows = (page: Page) => page.getByTestId('event-list').getByRole('listitem')
const row = (page: Page, text: string): Locator => eventRows(page).filter({ hasText: text })
const undoButton = (page: Page) => page.getByTestId('undo')
const redoButton = (page: Page) => page.getByTestId('redo')

// Убирает фокус из строки ввода, чтобы Ctrl+Z относился ко всему приложению, а не к тексту
async function focusApp(page: Page) {
  await page.getByTestId('save-state').click()
}

test('создание отменяется кнопкой и Ctrl+Z, возвращается кнопкой и Ctrl+Y', async ({ page }) => {
  await open(page)
  await expect(undoButton(page)).toBeDisabled()
  await expect(redoButton(page)).toBeDisabled()

  await input(page).fill('кр 21.10 важно')
  await input(page).press('Enter')
  await expect(row(page, 'важно')).toHaveCount(1)
  await expect(undoButton(page)).toBeEnabled()

  await focusApp(page)
  await undoButton(page).click()
  await expect(row(page, 'важно')).toHaveCount(0)
  await expect(redoButton(page)).toBeEnabled()

  await focusApp(page)
  await page.keyboard.press('Control+y')
  await expect(row(page, 'важно')).toHaveCount(1)
  await expect(redoButton(page)).toBeDisabled()

  await focusApp(page)
  await page.keyboard.press('Control+z')
  await expect(row(page, 'важно')).toHaveCount(0)

  await focusApp(page)
  await redoButton(page).click()
  await expect(row(page, 'важно')).toHaveCount(1)
})

test('Ctrl+Z в поле ввода не трогает события', async ({ page }) => {
  await open(page)
  await input(page).fill('кр 21.10 важно')
  await input(page).press('Enter')
  await expect(row(page, 'важно')).toHaveCount(1)

  await input(page).fill('кр 22.10 другое')
  await input(page).press('Control+z')
  await expect(row(page, 'важно')).toHaveCount(1)
})
