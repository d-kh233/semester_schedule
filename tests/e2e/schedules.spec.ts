import { expect, test, type Page } from '@playwright/test'
import { closeSettings, openSettings } from './helpers.js'

// «Сегодня» подставляется явно: 31.10.2026
async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
}

async function saved(page: Page) {
  await expect(page.getByTestId('save-state')).toHaveText('Сохранено')
}

async function switchTo(page: Page, name: string) {
  await page.getByTestId('schedule-select').selectOption({ label: name })
}

async function createSchedule(page: Page, name: string, start: string, end: string) {
  await openSettings(page)
  await page.getByLabel('Название', { exact: true }).fill(name)
  await page.getByLabel('Новое расписание: Начало семестра').fill(start)
  await page.getByLabel('Новое расписание: Конец семестра').fill(end)
  await page.getByRole('button', { name: 'Создать' }).click()
  await closeSettings(page)
}

test('первый запуск: «Моё расписание» и «Демо», данные сохранены', async ({ page }) => {
  await open(page)
  const select = page.getByTestId('schedule-select')
  await expect(select.locator('option')).toHaveText(['Моё расписание', 'Демо (демо)'])
  await expect(select.locator('option:checked')).toHaveText('Моё расписание')
  await saved(page)
})

test('новое расписание создаётся, открывается и запоминается после перезагрузки', async ({
  page,
}) => {
  await open(page)
  await createSchedule(page, 'Весна', '2027-02-01', '2027-06-30')
  await expect(page.getByTestId('month-2027-02')).toBeVisible()
  await expect(page.getByTestId('month-2026-09')).toHaveCount(0)

  await switchTo(page, 'Моё расписание')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
  await expect(page.getByTestId('month-2027-02')).toHaveCount(0)
  await saved(page)

  await page.reload()
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
  const options = page.getByTestId('schedule-select').locator('option')
  await expect(options).toHaveText(['Моё расписание', 'Демо (демо)', 'Весна'])
  await switchTo(page, 'Весна')
  await expect(page.getByTestId('month-2027-06')).toBeVisible()
})

test('новое расписание: название обязательно, неверные даты не принимаются', async ({ page }) => {
  await open(page)
  await openSettings(page)
  await page.getByRole('button', { name: 'Создать' }).click()
  await expect(page.getByRole('alert')).toHaveText('Введите название.')

  await page.getByLabel('Название', { exact: true }).fill('Тест')
  await page.getByLabel('Новое расписание: Конец семестра').fill('2026-01-01')
  await page.getByRole('button', { name: 'Создать' }).click()
  await expect(page.getByRole('alert')).toHaveText('Конец семестра раньше начала.')
  await expect(page.getByTestId('schedule-select').locator('option')).toHaveCount(2)
})

test('расписания независимы: даты демо не меняют «Моё расписание»', async ({ page }) => {
  await open(page)
  await switchTo(page, 'Демо (демо)')
  await openSettings(page)
  await page.getByLabel('Конец семестра', { exact: true }).fill('2026-12-31')
  await expect(page.getByTestId('month-2027-01')).toHaveCount(0)
  await closeSettings(page)

  await switchTo(page, 'Моё расписание')
  await expect(page.getByTestId('month-2027-01')).toBeVisible()
  await saved(page)

  await page.reload()
  await switchTo(page, 'Демо (демо)')
  await expect(page.getByTestId('month-2027-01')).toHaveCount(0)
})

test('переименование расписания', async ({ page }) => {
  await open(page)
  await openSettings(page)
  const input = page.getByRole('textbox', { name: 'Название расписания' }).first()
  await input.fill('Осень 2026')
  await input.press('Enter')
  await expect(
    page.getByTestId('schedule-select').locator('option').first(),
  ).toHaveText('Осень 2026')
})

test('архив: расписание скрывается и возвращается, единственное не уходит в архив', async ({
  page,
}) => {
  await open(page)
  await createSchedule(page, 'Весна', '2027-02-01', '2027-06-30')
  await expect(page.getByTestId('month-2027-02')).toBeVisible()

  // «Весна» третья в списке
  await openSettings(page)
  await page.getByRole('button', { name: 'В архив' }).nth(2).click()
  const options = page.getByTestId('schedule-select').locator('option')
  await expect(options).toHaveText(['Моё расписание', 'Демо (демо)'])
  // Открытым стало другое расписание, а «Весна» ждёт в архиве
  await expect(page.getByTestId('month-2027-02')).toHaveCount(0)
  await expect(page.getByTestId('archived-schedules')).toContainText('Весна')

  await page.getByTestId('archived-schedules').getByRole('button', { name: 'Вернуть' }).click()
  await expect(options).toHaveText(['Моё расписание', 'Демо (демо)', 'Весна'])

  // Остаётся одно расписание: его в архив убрать нельзя
  await page.getByRole('button', { name: 'В архив' }).nth(2).click()
  await page.getByRole('button', { name: 'В архив' }).nth(1).click()
  await expect(page.getByRole('button', { name: 'В архив' })).toBeDisabled()
  await expect(options).toHaveCount(1)
})

test('номера недель: единица на другой неделе меняет счёт во всей таблице', async ({ page }) => {
  await open(page)
  await expect(page.getByTestId('weeknum-2026-09-07')).toHaveText('1')

  await page.getByTestId('weeknum-2026-09-14').click()
  await page.getByTestId('weeknum-input').fill('1')
  await page.getByTestId('weeknum-input').press('Enter')
  await expect(page.getByTestId('weeknum-2026-09-07')).toHaveText('')
  await expect(page.getByTestId('weeknum-2026-09-14')).toHaveText('1')
  await expect(page.getByTestId('weeknum-2026-09-21')).toHaveText('2')
  await expect(page.getByTestId('weeknum-2026-10-26')).toHaveText('7')

  // 10 на 28 сентября: недели до неё получают номера, 14 сентября становится восьмой
  await page.getByTestId('weeknum-2026-09-28').click()
  await page.getByTestId('weeknum-input').fill('10')
  await page.getByTestId('weeknum-input').press('Enter')
  await expect(page.getByTestId('weeknum-2026-09-28')).toHaveText('10')
  await expect(page.getByTestId('weeknum-2026-09-14')).toHaveText('8')
  await expect(page.getByTestId('weeknum-2026-09-07')).toHaveText('7')
  await saved(page)

  await page.reload()
  await expect(page.getByTestId('weeknum-2026-09-14')).toHaveText('8')

  // В другом расписании счёт свой
  await switchTo(page, 'Демо (демо)')
  await expect(page.getByTestId('weeknum-2026-09-07')).toHaveText('1')
})

test('номера недель: Esc и неверное число ничего не меняют', async ({ page }) => {
  await open(page)
  await page.getByTestId('weeknum-2026-09-14').click()
  await page.getByTestId('weeknum-input').fill('5')
  await page.getByTestId('weeknum-input').press('Escape')
  await expect(page.getByTestId('weeknum-2026-09-14')).toHaveText('2')

  await page.getByTestId('weeknum-2026-09-14').click()
  await page.getByTestId('weeknum-input').fill('0')
  await page.getByTestId('weeknum-input').press('Enter')
  await expect(page.getByTestId('weeknum-2026-09-14')).toHaveText('2')

  await page.getByTestId('weeknum-2026-09-14').click()
  await page.getByTestId('weeknum-input').fill('')
  await page.getByTestId('weeknum-input').press('Enter')
  await expect(page.getByTestId('weeknum-2026-09-14')).toHaveText('2')
})

test('ширина столбца тянется за границу, запоминается и своя у каждого расписания', async ({
  page,
}) => {
  await open(page)
  const head = page.getByTestId('head-31')
  const before = (await head.boundingBox())?.width ?? 0
  expect(before).toBe(52)

  await head.scrollIntoViewIfNeeded()
  const handle = await page.getByTestId('resize-31').boundingBox()
  expect(handle).not.toBeNull()
  const x = handle!.x + handle!.width / 2
  const y = handle!.y + handle!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 10, y)
  await page.mouse.move(x - 20, y)
  await page.mouse.up()
  await expect.poll(async () => (await head.boundingBox())?.width).toBe(32)
  await saved(page)

  await page.reload()
  await expect.poll(async () => (await page.getByTestId('head-31').boundingBox())?.width).toBe(32)
  // Другие столбцы не тронуты
  expect((await page.getByTestId('head-30').boundingBox())?.width).toBe(52)

  await switchTo(page, 'Демо (демо)')
  await expect.poll(async () => (await page.getByTestId('head-31').boundingBox())?.width).toBe(52)
})

test('«Вписать в окно»: все 31 число помещаются без прокрутки вбок, «Сбросить» возвращает 52', async ({
  page,
}) => {
  await open(page)
  const scroll = page.getByRole('region', { name: 'Сетка семестра' })
  const overflowBefore = await scroll.evaluate((el) => el.scrollWidth - el.clientWidth)
  expect(overflowBefore).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Вписать в окно' }).click()
  await expect
    .poll(async () => scroll.evaluate((el) => el.scrollWidth - el.clientWidth))
    .toBeLessThanOrEqual(0)

  await openSettings(page)
  await page.getByRole('button', { name: 'Сбросить ширину' }).click()
  await closeSettings(page)
  await expect.poll(async () => (await page.getByTestId('head-5').boundingBox())?.width).toBe(52)
})

test('старые настройки из localStorage переезжают в «Моё расписание» и не удаляются', async ({
  page,
}) => {
  const febColor = '#112233'
  await page.addInitScript((color) => {
    const colors = Array<string>(12).fill('#cccccc')
    colors[1] = color
    localStorage.setItem(
      'semester-schedule:settings',
      JSON.stringify({
        semesterStart: '2027-02-01',
        semesterEnd: '2027-06-30',
        monthColors: colors,
        mutePastDays: false,
      }),
    )
  }, febColor)
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')

  await expect(page.getByTestId('month-2027-02')).toBeVisible()
  await expect(page.getByTestId('month-2027-02')).toHaveCSS('background-color', 'rgb(17, 34, 51)')
  await openSettings(page)
  await expect(page.getByLabel('Приглушить прошедшие дни')).not.toBeChecked()
  await closeSettings(page)
  const kept = await page.evaluate(() => localStorage.getItem('semester-schedule:settings'))
  expect(kept).not.toBeNull()

  await switchTo(page, 'Демо (демо)')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
})
