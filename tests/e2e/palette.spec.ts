import { expect, test, type Locator, type Page } from '@playwright/test'
import { closeSettings, openGrid, openList, openSettings } from './helpers.js'

// «Сегодня» подставляется явно: 31.10.2026 (суббота)
async function openDemo(page: Page) {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })
  await openList(page)
  await expect(page.locator('[data-testid="event-list"], [data-testid="someday-list"]').getByRole('listitem')).toHaveCount(10)
  await openGrid(page)
}

const saved = (page: Page) => expect(page.getByTestId('save-state')).toHaveText('Сохранено')
const variants = (page: Page) => page.locator('.auto-palette__variant')
const month = (page: Page) => page.getByTestId('month-2026-10')
const block = (page: Page): Locator =>
  page.locator('[data-testid^="block-2026-12-"]').filter({ hasText: 'Англ КР' })

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

test('дни недели берут базовые цвета: пн — первый, ср — второй, вс — третий; цвет дня правится вручную', async ({
  page,
}) => {
  await openDemo(page)
  await openSettings(page)
  await page.getByTestId('variant-apply-0').click()
  await saved(page)
  await closeSettings(page)
  // 2 ноября 2026 — понедельник, 4-е — среда, 1-е — воскресенье
  await expect(page.getByTestId('weekday-2026-11-2')).toHaveCSS('background-color', 'rgb(125, 48, 64)')
  await expect(page.getByTestId('weekday-2026-11-4')).toHaveCSS('background-color', 'rgb(224, 164, 94)')
  await expect(page.getByTestId('weekday-2026-11-1')).toHaveCSS('background-color', 'rgb(157, 180, 207)')
  // вторник — плавный переход между первым и вторым цветом
  await expect(page.getByTestId('weekday-2026-11-3')).toHaveCSS('background-color', 'rgb(175, 106, 79)')

  await openSettings(page)
  await page.getByTestId('week-color-1').fill('#336699')
  await saved(page)
  await closeSettings(page)
  await expect(page.getByTestId('weekday-2026-11-3')).toHaveCSS('background-color', 'rgb(51, 102, 153)')
  await expect(page.getByTestId('weekday-2026-11-2')).toHaveCSS('background-color', 'rgb(125, 48, 64)')

  await page.reload()
  await expect(page.getByTestId('weekday-2026-11-3')).toHaveCSS('background-color', 'rgb(51, 102, 153)')
})

test('палитра применяется только к открытому расписанию, другое не меняется', async ({ page }) => {
  await openDemo(page)
  await openSettings(page)
  await expect(page.getByTestId('palette-scope')).toContainText('«Демо»')
  await page.getByTestId('variant-apply-0').click()
  await saved(page)
  await closeSettings(page)
  await expect(month(page)).not.toHaveCSS('background-color', DEFAULT_MONTH)

  // «Моё расписание» осталось с прежними цветами
  await page.getByTestId('schedule-select').selectOption({ label: 'Моё расписание' })
  await expect(page.getByTestId('month-2026-10')).toHaveCSS('background-color', DEFAULT_MONTH)
  await expect(page.getByTestId('weekday-2026-11-2')).not.toHaveCSS('background-color', 'rgb(125, 48, 64)')

  // после перезагрузки у каждого расписания своя палитра
  await page.reload()
  await expect(page.getByTestId('month-2026-10')).toHaveCSS('background-color', DEFAULT_MONTH)
  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })
  await expect(month(page)).not.toHaveCSS('background-color', DEFAULT_MONTH)
})

test('ручная правка цвета тоже относится только к своему расписанию', async ({ page }) => {
  await openDemo(page)
  await openSettings(page)
  await page.getByLabel('Октябрь', { exact: true }).fill('#336699')
  await saved(page)
  await closeSettings(page)
  await expect(month(page)).toHaveCSS('background-color', 'rgb(51, 102, 153)')
  await page.getByTestId('schedule-select').selectOption({ label: 'Моё расписание' })
  await expect(page.getByTestId('month-2026-10')).toHaveCSS('background-color', DEFAULT_MONTH)
})

test('сохранённая палитра: сохранить, применить к другому расписанию, пережить перезагрузку', async ({
  page,
}) => {
  await openDemo(page)
  await openSettings(page)
  await page.getByTestId('variant-apply-1').click()
  await page.getByTestId('saved-name').fill('Осень')
  await page.getByTestId('saved-save').click()
  await expect(page.getByTestId('saved-Осень')).toBeVisible()
  await saved(page)
  const demoMonth = await (async () => {
    await closeSettings(page)
    return month(page).evaluate((el) => getComputedStyle(el).backgroundColor)
  })()

  // правка текущей палитры не меняет сохранённую
  await openSettings(page)
  await page.getByLabel('Октябрь', { exact: true }).fill('#336699')
  await saved(page)
  await closeSettings(page)

  await page.reload()
  await page.getByTestId('schedule-select').selectOption({ label: 'Моё расписание' })
  await expect(page.getByTestId('month-2026-10')).toHaveCSS('background-color', DEFAULT_MONTH)
  await openSettings(page)
  await expect(page.getByTestId('saved-Осень')).toBeVisible()
  await page.getByTestId('saved-Осень').getByTestId('saved-apply').click()
  await saved(page)
  await closeSettings(page)
  await expect(page.getByTestId('month-2026-10')).toHaveCSS('background-color', demoMonth)
})

test('название сохранённой палитры: пустое и повтор — ошибка; удаление только с подтверждением', async ({
  page,
}) => {
  await openDemo(page)
  await openSettings(page)
  await page.getByTestId('saved-save').click()
  await expect(page.getByRole('alert')).toContainText('Введите название')
  await page.getByTestId('saved-name').fill('Весна')
  await page.getByTestId('saved-save').click()
  await expect(page.getByTestId('saved-Весна')).toBeVisible()
  await page.getByTestId('saved-name').fill('весна')
  await page.getByTestId('saved-save').click()
  await expect(page.getByRole('alert')).toContainText('уже есть')

  await page.getByTestId('saved-delete').click()
  await page.getByRole('button', { name: 'Нет' }).click()
  await expect(page.getByTestId('saved-Весна')).toBeVisible()
  await page.getByTestId('saved-delete').click()
  await page.getByTestId('saved-delete-yes').click()
  await expect(page.getByTestId('saved-Весна')).toHaveCount(0)
  await saved(page)
})

const pastBlock = (page: Page): Locator =>
  page.locator('[data-testid^="block-2026-10-"]').filter({ hasText: 'Матан КР' })

test('прошедший блок: фон как у пустой ячейки, текст слабый по цвету палитры', async ({ page }) => {
  await openDemo(page)
  await expect(pastBlock(page)).toHaveClass(/block--past/)
  await expect(pastBlock(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  // тёмный цвет дней недели по умолчанию #4a1824 и прозрачность 35%
  await expect(pastBlock(page)).toHaveCSS('color', 'rgba(74, 24, 36, 0.35)')
  // блок, который ещё идёт, с цветом важности и обычным текстом
  await expect(block(page)).not.toHaveClass(/block--past/)
})

test('прозрачность текста прошедших блоков: образец и сетка меняются сразу, у каждого расписания своя', async ({
  page,
}) => {
  await openDemo(page)
  await openSettings(page)
  const sample = page.getByTestId('past-sample-block')
  await expect(sample).toHaveCSS('color', 'rgba(74, 24, 36, 0.35)')
  await page.getByTestId('past-opacity').fill('80')
  await expect(page.getByTestId('past-opacity-value')).toHaveText('80%')
  await expect(sample).toHaveCSS('color', 'rgba(74, 24, 36, 0.8)')
  await saved(page)
  await closeSettings(page)
  await expect(pastBlock(page)).toHaveCSS('color', 'rgba(74, 24, 36, 0.8)')

  await page.reload()
  await expect(pastBlock(page)).toHaveCSS('color', 'rgba(74, 24, 36, 0.8)')
  await page.getByTestId('schedule-select').selectOption({ label: 'Моё расписание' })
  await openSettings(page)
  await expect(page.getByTestId('past-opacity-value')).toHaveText('35%')
})

test('цвет «сегодня» у каждого расписания свой', async ({ page }) => {
  await openDemo(page)
  await expect(page.locator('.head--today')).toHaveCSS('background-color', 'rgb(74, 24, 36)')
  await openSettings(page)
  await page.getByTestId('today-color').fill('#00aa55')
  await saved(page)
  await closeSettings(page)
  await expect(page.locator('.head--today')).toHaveCSS('background-color', 'rgb(0, 170, 85)')
  await page.getByTestId('schedule-select').selectOption({ label: 'Моё расписание' })
  await expect(page.locator('.head--today')).toHaveCSS('background-color', 'rgb(74, 24, 36)')
})

test('цвета важности правятся в палитре и подбираются под палитру кнопкой', async ({ page }) => {
  await openDemo(page)
  await openSettings(page)
  await page.getByTestId('level-color-1').fill('#336699')
  await saved(page)
  await closeSettings(page)
  await expect(block(page)).toHaveCSS('background-color', 'rgb(51, 102, 153)')
  // другое расписание не затронуто
  await page.getByTestId('schedule-select').selectOption({ label: 'Моё расписание' })
  await openSettings(page)
  await expect(page.getByTestId('level-color-1')).toHaveValue('#c0502d')
  await closeSettings(page)
  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })

  await openSettings(page)
  await page.getByTestId('match-levels').click()
  await saved(page)
  await expect(page.getByTestId('level-color-1')).not.toHaveValue('#336699')
  await closeSettings(page)
  await expect(block(page)).not.toHaveCSS('background-color', 'rgb(51, 102, 153)')
})

test('автосборка подстраивает цвет «сегодня» под палитру, прозрачность остаётся', async ({ page }) => {
  await openDemo(page)
  await openSettings(page)
  await page.getByTestId('today-color').fill('#00aa55')
  await page.getByTestId('past-opacity').fill('60')
  await page.getByTestId('variant-apply-0').click()
  await expect(page.getByTestId('today-auto')).toBeChecked()
  await expect(page.getByTestId('past-opacity-value')).toHaveText('60%')
})
