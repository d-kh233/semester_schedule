import { expect, test, type Page } from '@playwright/test'
import { openGrid, openList } from './helpers.js'

// «Сегодня» подставляется явно: 31.10.2026 (суббота)
async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
}

async function openDemo(page: Page) {
  await open(page)
  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
}

async function saved(page: Page) {
  await expect(page.getByTestId('save-state')).toHaveText('Сохранено')
}

const hide = (page: Page, key: string) => page.getByTestId(`hide-${key}`).click()
const showAll = (page: Page) => page.getByTestId('show-all-months')

test('месяц можно скрыть: подпись, дни недели и ячейки исчезают, «Показать всё» возвращает', async ({
  page,
}) => {
  await open(page)
  await expect(showAll(page)).toHaveCount(0)

  await hide(page, '2026-10')
  await expect(page.getByTestId('month-2026-10')).toHaveCount(0)
  await expect(page.getByTestId('weekday-2026-10-5')).toHaveCount(0)
  await expect(page.getByTestId('cell-2026-10-5')).toHaveCount(0)
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
  await expect(page.getByTestId('month-2026-11')).toBeVisible()
  await expect(showAll(page)).toHaveText('Показать всё (1)')

  await hide(page, '2026-09')
  await expect(showAll(page)).toHaveText('Показать всё (2)')

  await showAll(page).click()
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
  await expect(page.getByTestId('month-2026-10')).toBeVisible()
  await expect(showAll(page)).toHaveCount(0)
})

test('скрытие помнится после перезагрузки и только в этом расписании', async ({ page }) => {
  await open(page)
  await hide(page, '2026-09')
  await saved(page)

  await page.reload()
  await expect(page.getByTestId('month-2026-10')).toBeVisible()
  await expect(page.getByTestId('month-2026-09')).toHaveCount(0)

  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
  await expect(showAll(page)).toHaveCount(0)
})

test('события скрытого месяца остаются в списке; хакатон виден в открытых месяцах', async ({
  page,
}) => {
  await openDemo(page)
  await page.getByRole('textbox', { name: 'Строка ввода' }).fill('хакатон 13.10–15.11')
  await page.getByRole('textbox', { name: 'Строка ввода' }).press('Enter')
  await expect(page.locator('[data-testid^="block-2026-10-"]').filter({ hasText: 'акатон' })).toHaveCount(1)
  await expect(page.locator('[data-testid^="block-2026-11-"]').filter({ hasText: 'акатон' })).toHaveCount(1)

  await hide(page, '2026-10')
  await expect(page.locator('[data-testid^="block-2026-10-"]')).toHaveCount(0)
  await expect(page.locator('[data-testid^="block-2026-11-"]').filter({ hasText: 'акатон' })).toHaveCount(1)

  await openList(page)
  await expect(page.locator('[data-testid="event-list"], [data-testid="someday-list"]').getByRole('listitem').filter({ hasText: 'акатон' })).toHaveCount(1)
  await expect(page.locator('[data-testid="event-list"], [data-testid="someday-list"]').getByRole('listitem')).toHaveCount(10)
  await openGrid(page)
})

test('текст в строке дней недели подстраивается под цвет ячейки', async ({ page }) => {
  await open(page)
  // Понедельник (самый тёмный) и среда (самая светлая) в ноябре 2026: 2-е и 4-е числа
  const color = (key: string) => page.getByTestId(key).evaluate((el) => getComputedStyle(el).color)
  expect(await color('weekday-2026-11-2')).toBe('rgb(255, 255, 255)')
  expect(await color('weekday-2026-11-4')).toBe('rgb(31, 31, 31)')
})
