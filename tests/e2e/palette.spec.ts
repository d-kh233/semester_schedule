import { expect, test, type Locator, type Page } from '@playwright/test'
import { closeSettings, openGrid, openList, openSettings } from './helpers.js'

// «Сегодня» подставляется явно: 31.10.2026 (суббота)
async function openDemo(page: Page) {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })
  await openList(page)
  await expect(page.getByTestId('event-list').getByRole('listitem')).toHaveCount(10)
  await openGrid(page)
}

const saved = (page: Page) => expect(page.getByTestId('save-state')).toHaveText('Сохранено')
const variants = (page: Page) => page.locator('.auto-palette__variant')
const month = (page: Page) => page.getByTestId('month-2026-10')
const block = (page: Page): Locator =>
  page.locator('[data-testid^="block-2026-10-"]').filter({ hasText: 'Матан КР' })

const DEFAULT_MONTH = 'rgb(201, 154, 120)'
const DEFAULT_LEVEL_1 = 'rgb(192, 80, 45)'

test('по умолчанию 3 базовых цвета и 4 варианта; число вариантов растёт с цветами', async ({ page }) => {
  await openDemo(page)
  await openSettings(page)
  await expect(page.getByTestId('base-color-2')).toBeVisible()
  await expect(page.getByTestId('base-color-3')).toHaveCount(0)
  await expect(variants(page)).toHaveCount(4)
  // меньше трёх цветов убрать нельзя
  await expect(page.getByTestId('base-remove-0')).toBeDisabled()

  await page.getByTestId('base-add').click()
  await expect(variants(page)).toHaveCount(5)
  await page.getByTestId('base-add').click()
  await expect(variants(page)).toHaveCount(6)
  for (let i = 0; i < 2; i++) await page.getByTestId('base-add').click()
  await expect(page.getByTestId('base-add')).toBeDisabled() // семь цветов — предел
  await expect(variants(page)).toHaveCount(6)
  await saved(page)
})

test('пока не нажато «Применить», цвета сетки не меняются; после — меняются и сохраняются', async ({
  page,
}) => {
  await openDemo(page)
  await expect(month(page)).toHaveCSS('background-color', DEFAULT_MONTH)
  await expect(block(page)).toHaveCSS('background-color', DEFAULT_LEVEL_1)

  await openSettings(page)
  await page.getByTestId('base-color-0').fill('#336699')
  await saved(page)
  await closeSettings(page)
  await expect(month(page)).toHaveCSS('background-color', DEFAULT_MONTH)

  await openSettings(page)
  await page.getByTestId('variant-apply-0').click()
  await saved(page)
  await closeSettings(page)
  await expect(month(page)).not.toHaveCSS('background-color', DEFAULT_MONTH)
  await expect(block(page)).not.toHaveCSS('background-color', DEFAULT_LEVEL_1)
  const monthAfter = await month(page).evaluate((el) => getComputedStyle(el).backgroundColor)

  // после перезагрузки и палитра, и базовые цвета на месте
  await page.reload()
  await expect(page.getByTestId('month-2026-10')).toBeVisible()
  await expect(month(page)).toHaveCSS('background-color', monthAfter)
  await openSettings(page)
  await expect(page.getByTestId('base-color-0')).toHaveValue('#336699')
})

test('«Вернуть прежнюю» возвращает цвета, бывшие до применения', async ({ page }) => {
  await openDemo(page)
  await openSettings(page)
  await page.getByTestId('variant-apply-1').click()
  await expect(page.getByTestId('palette-restore')).toBeVisible()
  await page.getByTestId('palette-restore').click()
  await saved(page)
  await closeSettings(page)
  await expect(month(page)).toHaveCSS('background-color', DEFAULT_MONTH)
  await expect(block(page)).toHaveCSS('background-color', DEFAULT_LEVEL_1)
})

test('ручная правка после применения остаётся (ручное сильнее автоматики)', async ({ page }) => {
  await openDemo(page)
  await openSettings(page)
  await page.getByTestId('variant-apply-0').click()
  await page.getByLabel('Октябрь', { exact: true }).fill('#336699')
  await saved(page)
  await closeSettings(page)
  await expect(month(page)).toHaveCSS('background-color', 'rgb(51, 102, 153)')

  // смена базовых цветов сама ничего не перекрашивает
  await openSettings(page)
  await page.getByTestId('base-color-1').fill('#00aa55')
  await saved(page)
  await closeSettings(page)
  await expect(month(page)).toHaveCSS('background-color', 'rgb(51, 102, 153)')
})

test('кнопка «Вернуть цвета по умолчанию» возвращает и цвета уровней', async ({ page }) => {
  await openDemo(page)
  await openSettings(page)
  await page.getByTestId('variant-apply-2').click()
  await page.getByRole('button', { name: 'Вернуть цвета по умолчанию' }).click()
  await saved(page)
  await closeSettings(page)
  await expect(month(page)).toHaveCSS('background-color', DEFAULT_MONTH)
  await expect(block(page)).toHaveCSS('background-color', DEFAULT_LEVEL_1)
})

test('повтор базового цвета: подсказка об ошибке, предыдущий верный набор сохранён', async ({
  page,
}) => {
  await openDemo(page)
  await openSettings(page)
  await page.getByTestId('base-color-1').fill('#7d3040')
  await expect(page.getByRole('alert')).toContainText('одинаковые')
  await expect(variants(page)).toHaveCount(0)
  await page.getByTestId('base-color-1').fill('#00aa55')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(variants(page)).toHaveCount(4)
})
