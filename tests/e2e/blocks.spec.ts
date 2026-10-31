import { expect, test, type Locator, type Page } from '@playwright/test'
import { openGrid, openList, openSettings } from './helpers.js'

// «Сегодня» подставляется явно: 31.10.2026 (суббота)
async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
}

async function openDemo(page: Page) {
  await open(page)
  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })
  await openList(page)
  await expect(page.getByTestId('event-list').getByRole('listitem')).toHaveCount(10)
  await openGrid(page)
}

async function saved(page: Page) {
  await expect(page.getByTestId('save-state')).toHaveText('Сохранено')
}

const input = (page: Page) => page.getByRole('textbox', { name: 'Строка ввода' })

async function enter(page: Page, text: string) {
  await input(page).fill(text)
  await input(page).press('Enter')
}

const blockOf = (page: Page, month: string, text: string): Locator =>
  page.locator(`[data-testid^="block-${month}-"]`).filter({ hasText: text })

async function top(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!.y
}

async function left(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!.x
}

// Блок отступает от границы клетки на 1–2 px
function near(a: number, b: number) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(2)
}

// Положение блока относительно строки дней недели его месяца: не зависит от подсказок над сеткой
async function offsetInMonth(page: Page, block: Locator, month: string): Promise<number> {
  return (await top(block)) - (await top(page.getByTestId(`weekday-${month}-21`)))
}

test('демо: события нарисованы блоками в сетке', async ({ page }) => {
  await openDemo(page)
  await expect(blockOf(page, '2026-10', 'Матан КР')).toHaveCount(1)
  await expect(blockOf(page, '2026-10', 'СИИБД КР')).toHaveCount(1)
  await expect(blockOf(page, '2026-11', 'СИИБД РТ 3,4')).toHaveCount(1)
  await expect(blockOf(page, '2026-11', 'Англ тест')).toHaveCount(1)
  await expect(blockOf(page, '2026-12', 'Подготовка к экзаменам')).toHaveCount(1)
  // дело без даты в сетке не показывается
  await expect(page.locator('.block').filter({ hasText: 'Физра тест' })).toHaveCount(0)
})

test('GC-1, GC-4: два КР в один день на разных строках, с большей важностью выше', async ({
  page,
}) => {
  await openDemo(page)
  const matan = blockOf(page, '2026-10', 'Матан КР')
  const siibd = blockOf(page, '2026-10', 'СИИБД КР')
  expect(await top(matan)).toBeLessThan(await top(siibd))
  // оба стоят в столбце 21 октября
  near(await left(matan), await left(siibd))
  near(await left(matan), await left(page.getByTestId('cell-2026-10-21')))
})

test('GC-3: хакатон 13.10–15.11 в нижней строке обоих месяцев, КР выше', async ({ page }) => {
  await openDemo(page)
  const hackOct = blockOf(page, '2026-10', 'Хакатон')
  const hackNov = blockOf(page, '2026-11', 'Хакатон')
  await expect(hackOct).toHaveCount(1)
  await expect(hackNov).toHaveCount(1)
  expect(await top(hackOct)).toBeGreaterThan(await top(blockOf(page, '2026-10', 'СИИБД КР')))
  // октябрьский кусок идёт с 13-го до края месяца, ноябрьский с 1-го по 15-е
  near(await left(hackOct), await left(page.getByTestId('cell-2026-10-13')))
  const novBox = await hackNov.boundingBox()
  const day15 = await page.getByTestId('cell-2026-11-15').boundingBox()
  expect(Math.abs(novBox!.x + novBox!.width - (day15!.x + day15!.width))).toBeLessThanOrEqual(2)
})

test('GC-6: событие 28.10–03.11 — по блоку в каждом месяце, на первой строке', async ({ page }) => {
  await openDemo(page)
  const oct = blockOf(page, '2026-10', 'Лаба')
  const nov = blockOf(page, '2026-11', 'Лаба')
  await expect(oct).toHaveCount(1)
  await expect(nov).toHaveCount(1)
  near(await left(oct), await left(page.getByTestId('cell-2026-10-28')))
  near(await left(nov), await left(page.getByTestId('cell-2026-11-1')))
  // в ноябре дедлайнов больше нет в эти дни: блок на самой верхней строке месяца
  expect(await top(nov)).toBeLessThan(await top(page.getByTestId('weekday-2026-11-1')) + 30)
})

test('BR-3: цвет блока по важности, хакатон своим цветом, без важности бесцветный', async ({
  page,
}) => {
  await openDemo(page)
  // КР по типу — важность 1 (#c0502d), СИИБД КР с ручной 3 (#f5dcc4), хакатон #f0a03c
  await expect(blockOf(page, '2026-10', 'Матан КР')).toHaveCSS('background-color', 'rgb(192, 80, 45)')
  await expect(blockOf(page, '2026-10', 'СИИБД КР')).toHaveCSS('background-color', 'rgb(245, 220, 196)')
  await expect(blockOf(page, '2026-10', 'Хакатон')).toHaveCSS('background-color', 'rgb(240, 160, 60)')
  const plain = blockOf(page, '2026-10', 'Лаба')
  await expect(plain).toHaveClass(/block--plain/)
  await expect(plain).toHaveCSS('background-color', 'rgb(255, 255, 255)')
})

test('GC-14, GC-15: прошедшие и выполненные блоки приглушены', async ({ page }) => {
  await openDemo(page)
  // 21.10 уже прошло, 14.12 выполнено
  await expect(blockOf(page, '2026-10', 'Матан КР')).toHaveClass(/block--past/)
  await expect(blockOf(page, '2026-12', 'Матан КР')).toHaveClass(/block--done/)
  await expect(blockOf(page, '2026-12', 'Англ КР')).not.toHaveClass(/block--(past|done)/)
  // блок, который ещё идёт, не приглушён
  await expect(blockOf(page, '2026-10', 'Хакатон')).not.toHaveClass(/block--past/)

  await openSettings(page)
  await page.getByLabel('Приглушить прошедшие дни').uncheck()
  await expect(blockOf(page, '2026-10', 'Матан КР')).not.toHaveClass(/block--past/)
})

test('двойной щелчок по блоку открывает карточку этого события', async ({ page }) => {
  await openDemo(page)
  await blockOf(page, '2026-11', 'Англ тест').dblclick()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Название', { exact: true })).toHaveValue('Англ. яз. тест')
})

test('строка ввода: событие сразу блоком в сетке, старые остаются на своих строках (GC-5)', async ({
  page,
}) => {
  await openDemo(page)
  const at = (text: string) => offsetInMonth(page, blockOf(page, '2026-10', text), '2026-10')
  const matanBefore = await at('Матан КР')
  const siibdBefore = await at('СИИБД КР')
  const hackBefore = await at('Хакатон')

  // новое событие раньше по дате, но создано позже: чужие строки не двигаются
  await enter(page, 'англ тест 21.10')
  await expect(blockOf(page, '2026-10', 'Англ тест')).toHaveCount(1)
  expect(await at('Матан КР')).toBe(matanBefore)
  expect(await at('СИИБД КР')).toBe(siibdBefore)
  // новая строка в месяце добавилась, хакатон ушёл ниже
  expect(await at('Хакатон')).toBeGreaterThan(hackBefore)
  expect(await at('Англ тест')).toBeGreaterThan(siibdBefore)
})

test('строки сохраняются после перезагрузки страницы', async ({ page }) => {
  await openDemo(page)
  await enter(page, 'англ тест 21.10')
  await expect(blockOf(page, '2026-10', 'Англ тест')).toHaveCount(1)
  await saved(page)
  const at = () => offsetInMonth(page, blockOf(page, '2026-10', 'Англ тест'), '2026-10')
  const before = await at()

  await page.reload()
  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })
  await expect(blockOf(page, '2026-10', 'Англ тест')).toHaveCount(1)
  expect(await at()).toBe(before)
})

test('практика с двумя окнами: два блока, планируемое с акцентом, людное помечено', async ({
  page,
}) => {
  await openDemo(page)
  await enter(page, 'практика сиибд 10.11, 24.11')
  // в демо нет других практик с несколькими окнами, поэтому классы считаем по всей сетке
  const planned = page.locator('.block--planned')
  const crowded = page.locator('.block--crowded')
  await expect(planned).toHaveCount(1)
  await expect(crowded).toHaveCount(1)
  // планируемое — самое раннее окно (10.11), людное — 24.11 (последние 7 дней ноября: 24–30)
  expect(await left(planned)).toBeLessThanOrEqual((await left(page.getByTestId('cell-2026-11-10'))) + 2)
  expect(await left(planned)).toBeGreaterThanOrEqual(await left(page.getByTestId('cell-2026-11-10')))
  expect(Math.abs((await left(crowded)) - (await left(page.getByTestId('cell-2026-11-24'))))).toBeLessThanOrEqual(2)
  await expect(planned).not.toHaveClass(/block--crowded/)
})

test('пересортировка: подтверждение, «Нет» ничего не меняет, «Да» убирает пустые строки', async ({
  page,
}) => {
  await open(page)
  await enter(page, 'аа 21.10')
  await expect(page.locator('.block').filter({ hasText: 'аа' })).toHaveCount(1)
  await enter(page, 'бб 21.10')
  await expect(page.locator('.block').filter({ hasText: 'бб' })).toHaveCount(1)
  await expect(page.locator('.block').filter({ hasText: 'аа' })).toHaveCount(1)
  await expect(page.getByTestId('cell-2026-10-21-r1')).toHaveCount(1)

  // убираем верхнее событие в архив: нижнее остаётся на своей строке, пустая строка сверху остаётся
  await page.locator('.block').filter({ hasText: 'аа' }).dblclick()
  await page.getByRole('dialog').getByRole('button', { name: 'В архив' }).click()
  await expect(page.locator('.block').filter({ hasText: 'аа' })).toHaveCount(0)
  await expect(page.getByTestId('cell-2026-10-21-r1')).toHaveCount(1)

  await page.getByRole('button', { name: 'Пересортировать' }).click()
  await page.getByRole('button', { name: 'Нет, оставить' }).click()
  await expect(page.getByTestId('cell-2026-10-21-r1')).toHaveCount(1)

  await page.getByRole('button', { name: 'Пересортировать' }).click()
  await page.getByRole('button', { name: 'Да, пересортировать' }).click()
  await expect(page.getByTestId('cell-2026-10-21-r1')).toHaveCount(0)
  await expect(page.locator('.block').filter({ hasText: 'бб' })).toHaveCount(1)
  await saved(page)

  await page.reload()
  await expect(page.getByTestId('cell-2026-10-21-r1')).toHaveCount(0)
  await expect(page.locator('.block').filter({ hasText: 'бб' })).toHaveCount(1)
})

test('GC-8 на уровне раскладки: событие после архива и возврата встаёт на ту же строку', async ({
  page,
}) => {
  await open(page)
  await enter(page, 'аа 21.10')
  await expect(page.locator('.block').filter({ hasText: 'аа' })).toHaveCount(1)
  await enter(page, 'бб 21.10')
  await expect(page.locator('.block').filter({ hasText: 'бб' })).toHaveCount(1)
  const aa = page.locator('.block').filter({ hasText: 'аа' })
  const bb = page.locator('.block').filter({ hasText: 'бб' })
  const at = (block: Locator) => offsetInMonth(page, block, '2026-10')
  const before = await at(bb)

  await bb.dblclick()
  await page.getByRole('dialog').getByRole('button', { name: 'В архив' }).click()
  await expect(bb).toHaveCount(0)
  await openList(page)
  await page.getByTestId('event-archive').getByRole('button', { name: 'Вернуть' }).click()
  await openGrid(page)
  await expect(bb).toHaveCount(1)
  expect(await at(bb)).toBe(before)
  expect(await at(aa)).toBeLessThan(before)
})

test('снимок демо для ручной проверки', async ({ page }, testInfo) => {
  await openDemo(page)
  await enter(page, 'практика сиибд 10.11, 24.11')
  await expect(page.locator('.block--crowded')).toHaveCount(1)
  await page.screenshot({
    path: `test-results/blocks-${testInfo.project.name}.png`,
    fullPage: true,
  })

  // все 31 число в окне, сетка прокручена к ноябрю: видны оба окна практики
  await page.getByRole('button', { name: 'Вписать в окно' }).click()
  await page.getByTestId('month-2026-11').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `test-results/blocks-fit-${testInfo.project.name}.png` })
})
