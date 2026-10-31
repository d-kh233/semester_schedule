import { expect, test, type Page } from '@playwright/test'
import { openGrid, openList } from './helpers.js'

// «Сегодня» подставляется явно: 31.10.2026 (суббота)
async function openDemo(page: Page) {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })
}

const cellInput = (page: Page) => page.getByTestId('cell-input').getByRole('textbox')
const blocksOf = (page: Page, text: string) =>
  page.locator('[data-testid^="block-2026-12-"]').filter({ hasText: text })

test('«1 КР физра» в ячейке: важность 1, предмет и тип разобраны, дата ячейки', async ({ page }) => {
  await openDemo(page)
  await page.getByTestId('cell-2026-12-9').click()
  await cellInput(page).fill('1 КР физра')
  await cellInput(page).press('Enter')

  await expect(page.getByTestId('cell-input')).toHaveCount(0)
  await expect(page.getByTestId('input-toast')).toContainText('Физра КР')
  await expect(page.getByTestId('input-toast')).toContainText('09.12.2026')
  await expect(blocksOf(page, 'Физра КР')).toHaveCount(1)

  await blocksOf(page, 'Физра КР').dblclick()
  await expect(page.getByRole('dialog').getByLabel('Важность')).toHaveValue('1')
  await expect(page.getByRole('dialog').getByLabel('Начало', { exact: true })).toHaveValue('2026-12-09')
})

test('своя дата в тексте не важна: берётся дата ячейки', async ({ page }) => {
  await openDemo(page)
  await page.getByTestId('cell-2026-12-9').click()
  await cellInput(page).fill('англ тест 25.12')
  await cellInput(page).press('Enter')

  await expect(page.getByTestId('input-toast')).toContainText('09.12.2026')
  await expect(blocksOf(page, 'Англ').first()).toBeVisible()
})

test('Esc отменяет ввод, ничего не создаётся', async ({ page }) => {
  await openDemo(page)
  await page.getByTestId('cell-2026-12-9').click()
  await cellInput(page).fill('1 КР физра')
  await cellInput(page).press('Escape')

  await expect(page.getByTestId('cell-input')).toHaveCount(0)
  await expect(page.getByTestId('input-toast')).toHaveCount(0)
  await expect(blocksOf(page, 'Физра КР')).toHaveCount(0)
})

test('ошибка показывается прямо у ячейки, событие не теряется', async ({ page }) => {
  await openDemo(page)
  await page.getByTestId('cell-2026-12-9').click()
  await cellInput(page).fill('5 физра кр')
  await cellInput(page).press('Enter')

  await expect(page.getByTestId('cell-input')).toContainText('Уровня 5 нет')
  await page.getByTestId('cell-input').getByRole('button', { name: 'Выбрать 2' }).click()
  await expect(page.getByTestId('cell-input')).toHaveCount(0)
  await expect(blocksOf(page, 'Физра КР')).toHaveCount(1)
})

test('вкладки: список дедлайнов отдельной страницей, кнопки сетки только в «Сетке»', async ({
  page,
}) => {
  await openDemo(page)
  await expect(page.getByRole('button', { name: 'Пересортировать' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Сетка семестра' })).toBeVisible()

  await openList(page)
  await expect(page.getByRole('region', { name: 'Сетка семестра' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Пересортировать' })).toHaveCount(0)
  // строка ввода доступна и на этой вкладке
  await expect(page.getByRole('textbox', { name: 'Строка ввода' })).toBeVisible()

  await openGrid(page)
  await expect(page.getByRole('button', { name: 'Пересортировать' })).toBeVisible()
})
