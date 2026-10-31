import { expect, test, type Page } from '@playwright/test'

// «Сегодня» подставляется явно: 31.10.2026, суббота
async function openWithToday(page: Page) {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
}

async function brightness(page: Page, testId: string): Promise<number> {
  const color = await page
    .getByTestId(testId)
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  const [r = 0, g = 0, b = 0] = (color.match(/\d+/g) ?? []).map(Number)
  return r + g + b
}

test('сетка: месяцы слева, числа 1–31 сверху, под каждым месяцем дни недели', async ({ page }) => {
  await openWithToday(page)
  for (const key of ['2026-09', '2026-10', '2026-11', '2026-12', '2027-01']) {
    await expect(page.getByTestId(`month-${key}`)).toBeVisible()
  }
  await expect(page.getByTestId('month-2026-09')).toContainText('Сентябрь')
  await expect(page.getByTestId('head-1')).toHaveText('1')
  await expect(page.getByTestId('head-31')).toHaveText('31')
  // 01.09.2026 — вторник, 31.10.2026 — суббота
  await expect(page.getByTestId('weekday-2026-09-1')).toHaveText('вт')
  await expect(page.getByTestId('weekday-2026-10-31')).toHaveText('сб')
  await expect(page.getByTestId('month-2026-08')).toHaveCount(0)
})

test('GC-7: 31 ноября серая клетка', async ({ page }) => {
  await openWithToday(page)
  await expect(page.getByTestId('cell-2026-11-31')).toHaveClass(/cell--blank-gray/)
  await expect(page.getByTestId('weekday-2026-11-31')).toHaveClass(/cell--blank-gray/)
  await expect(page.getByTestId('cell-2026-10-31')).not.toHaveClass(/cell--blank/)
})

test('режим «вне рамки календаря» для несуществующих дней', async ({ page }) => {
  await openWithToday(page)
  await page.getByLabel('Несуществующие дни (31 ноября)').selectOption('hidden')
  await expect(page.getByTestId('cell-2026-11-31')).toHaveClass(/cell--blank-hidden/)
  await expect(page.getByTestId('cell-2026-11-31')).not.toHaveClass(/cell--blank-gray/)
})

test('FR-3: сегодняшний день выделен, число в шапке тоже', async ({ page }) => {
  await openWithToday(page)
  await expect(page.getByTestId('cell-2026-10-31')).toHaveClass(/cell--today/)
  await expect(page.getByTestId('weekday-2026-10-31')).toHaveClass(/cell--today/)
  await expect(page.getByTestId('head-31')).toHaveClass(/head--today/)
  await expect(page.getByTestId('head-30')).not.toHaveClass(/head--today/)
  await expect(page.getByTestId('cell-2026-10-30')).not.toHaveClass(/cell--today/)
})

test('GC-14: прошедшие дни приглушены, настройка отключает приглушение', async ({ page }) => {
  await openWithToday(page)
  await expect(page.getByTestId('cell-2026-10-30')).toHaveClass(/cell--past/)
  await expect(page.getByTestId('weekday-2026-09-1')).toHaveClass(/cell--past/)
  await expect(page.getByTestId('cell-2026-11-1')).not.toHaveClass(/cell--past/)
  await expect(page.getByTestId('cell-2026-10-31')).not.toHaveClass(/cell--past/)

  await page.getByLabel('Приглушить прошедшие дни').uncheck()
  await expect(page.getByTestId('cell-2026-10-30')).not.toHaveClass(/cell--past/)
})

test('FR-2: градиент недели: среда светлее понедельника и воскресенья', async ({ page }) => {
  await openWithToday(page)
  // 26.10 понедельник, 28.10 среда, 01.11 воскресенье
  const monday = await brightness(page, 'weekday-2026-10-26')
  const wednesday = await brightness(page, 'weekday-2026-10-28')
  const sunday = await brightness(page, 'weekday-2026-11-1')
  expect(wednesday).toBeGreaterThan(monday)
  expect(wednesday).toBeGreaterThan(sunday)
  expect(monday).toBe(sunday)
})

test('семестр настраивается: сетка перестраивается и запоминается после перезагрузки', async ({
  page,
}) => {
  await openWithToday(page)
  await page.getByLabel('Начало семестра').fill('2027-02-01')
  await page.getByLabel('Конец семестра').fill('2027-06-30')
  await expect(page.getByTestId('month-2027-02')).toBeVisible()
  await expect(page.getByTestId('month-2027-06')).toBeVisible()
  await expect(page.getByTestId('month-2026-09')).toHaveCount(0)
  // 28.02.2027 — воскресенье, 29-го числа в феврале нет
  await expect(page.getByTestId('cell-2027-02-29')).toHaveClass(/cell--blank-gray/)

  await page.reload()
  await expect(page.getByTestId('month-2027-02')).toBeVisible()
  await expect(page.getByLabel('Начало семестра')).toHaveValue('2027-02-01')
})

test('неверный семестр: понятное сообщение, прежняя сетка не ломается', async ({ page }) => {
  await openWithToday(page)
  await page.getByLabel('Конец семестра').fill('2026-08-01')
  await expect(page.getByRole('alert')).toHaveText('Конец семестра раньше начала.')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()

  await page.getByLabel('Конец семестра').fill('2027-01-31')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('снимок экрана для ручной проверки', async ({ page }, testInfo) => {
  await openWithToday(page)
  await page.screenshot({ path: `test-results/grid-${testInfo.project.name}.png` })
})

test('как в таблице: строка дней недели над строками месяца, подпись месяца без года', async ({
  page,
}) => {
  await openWithToday(page)
  const weekdayBox = await page.getByTestId('weekday-2026-10-5').boundingBox()
  const laneBox = await page.getByTestId('cell-2026-10-5').boundingBox()
  expect(weekdayBox).not.toBeNull()
  expect(laneBox).not.toBeNull()
  expect(weekdayBox!.y).toBeLessThan(laneBox!.y)
  await expect(page.getByTestId('month-2026-10')).toHaveText('Октябрь')
})

test('номера недель: маленькая цифра в понедельнике, первая неделя с первого понедельника', async ({
  page,
}) => {
  await openWithToday(page)
  await expect(page.getByTestId('weeknum-2026-09-07')).toHaveText('1')
  await expect(page.getByTestId('weeknum-2026-09-14')).toHaveText('2')
  await expect(page.getByTestId('weeknum-2026-10-26')).toHaveText('8')
  // 01.09 вторник, 13.09 воскресенье: номеров нет
  await expect(page.getByTestId('weeknum-2026-09-01')).toHaveCount(0)
  await expect(page.getByTestId('weeknum-2026-09-13')).toHaveCount(0)
})

test('палитра настраивается: цвет месяца и градиент дней недели', async ({ page }) => {
  await openWithToday(page)
  await page.getByText('Палитра').click()
  await page.getByLabel('Октябрь', { exact: true }).fill('#336699')
  await expect(page.getByTestId('month-2026-10')).toHaveCSS('background-color', 'rgb(51, 102, 153)')

  const before = await brightness(page, 'weekday-2026-10-28')
  await page.getByLabel('Дни недели: светлый (среда)').fill('#000000')
  const after = await brightness(page, 'weekday-2026-10-28')
  expect(after).toBeLessThan(before)

  await page.reload()
  await expect(page.getByTestId('month-2026-10')).toHaveCSS('background-color', 'rgb(51, 102, 153)')

  await page.getByText('Палитра').click()
  await page.getByRole('button', { name: 'Вернуть цвета по умолчанию' }).click()
  await expect(page.getByTestId('month-2026-10')).toHaveCSS('background-color', 'rgb(201, 154, 120)')
})
