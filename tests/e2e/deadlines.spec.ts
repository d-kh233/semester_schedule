import { expect, test, type Page } from '@playwright/test'
import { openList } from './helpers.js'

// «Сегодня» подставляется явно: 31.10.2026
async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
}

async function openDemoList(page: Page) {
  await open(page)
  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })
  await openList(page)
}

const dedlineRows = (page: Page) => page.getByTestId('event-list').getByRole('listitem')
const somedayRows = (page: Page) => page.getByTestId('someday-list').getByRole('listitem')

test('LC-2: отметка «выполнено» в списке уводит дедлайн вниз и приглушает его', async ({ page }) => {
  await openDemoList(page)
  const target = dedlineRows(page).filter({ hasText: 'Англ. яз. тест' })
  await target.getByRole('checkbox').check()
  await expect(target).toHaveClass(/is-done/)
  // Выполненные стоят ниже всех невыполненных (среди выполненных порядок по дате)
  const items = dedlineRows(page)
  const texts = await items.allTextContents()
  const classes = await items.evaluateAll((els) => els.map((el) => el.className))
  const position = texts.findIndex((t) => t.includes('Англ. яз. тест'))
  const lastOpen = classes.lastIndexOf('')
  expect(position).toBeGreaterThan(lastOpen)
})

test('LC-4: дело без даты в «Когда-нибудь»; назначенная дата переносит его в список дедлайнов', async ({
  page,
}) => {
  await openDemoList(page)
  const someday = somedayRows(page).filter({ hasText: 'Физра тест' })
  await expect(someday).toHaveCount(1)

  await someday.getByRole('textbox', { name: 'Дата' }).fill('2026-11-20')
  await someday.getByRole('button', { name: 'Назначить дату' }).click()

  await expect(somedayRows(page).filter({ hasText: 'Физра тест' })).toHaveCount(0)
  await expect(dedlineRows(page).filter({ hasText: 'Физра тест' })).toHaveCount(1)
})

test('LC-4: дата вне семестра не назначается, показывается предупреждение', async ({ page }) => {
  await openDemoList(page)
  const someday = somedayRows(page).filter({ hasText: 'Физра тест' })
  await someday.getByRole('textbox', { name: 'Дата' }).fill('2099-01-01')
  await someday.getByRole('button', { name: 'Назначить дату' }).click()
  await expect(someday).toContainText('Дата вне семестра')
  await expect(somedayRows(page).filter({ hasText: 'Физра тест' })).toHaveCount(1)
})

test('окно «Предметы»: добавить предмет с весом, список дедлайнов предмета в тексте', async ({
  page,
}) => {
  await open(page)
  await openList(page)
  await page.getByRole('tab', { name: 'Предметы' }).click()
  await expect(page.getByRole('region', { name: 'Предметы' })).toBeVisible()

  const form = page.locator('form.subjects__add')
  await form.getByLabel('Полное имя').fill('Химия')
  await form.getByLabel('Короткое имя').fill('хим')
  await form.getByLabel('Вес').fill('5')
  await form.getByRole('button', { name: 'Добавить предмет' }).click()

  const list = page.getByTestId('subjects-list')
  await expect(list.getByRole('listitem').filter({ hasText: 'Химия' })).toContainText('Вес 5')
})

test('окно «Предметы»: вес вне 1–10 не сохраняется', async ({ page }) => {
  await open(page)
  await openList(page)
  await page.getByRole('tab', { name: 'Предметы' }).click()
  const form = page.locator('form.subjects__add')
  await form.getByLabel('Полное имя').fill('Химия')
  await form.getByLabel('Короткое имя').fill('хим')
  await form.getByLabel('Вес').fill('11')
  await form.getByRole('button', { name: 'Добавить предмет' }).click()
  await expect(form).toContainText('Вес: целое число от 1 до 10')
  await expect(page.getByTestId('subjects-list')).toHaveCount(0)
})

test('окно «Предметы» в демо: текст списка дедлайнов предмета по возрастанию дат', async ({
  page,
}) => {
  await openDemoList(page)
  await page.getByRole('tab', { name: 'Предметы' }).click()
  const row = page.getByTestId('subjects-list').getByRole('listitem').filter({ hasText: 'Англ. яз.' })
  await row.locator('summary').click()
  const text = row.getByRole('textbox', { name: 'Англ. яз.' })
  await expect(text).toHaveValue(/^Англ\. яз\.:\n1\. /)
})

test('«Когда-нибудь» стоит справа от дедлайнов на широком экране', async ({ page }) => {
  await openDemoList(page)
  const viewport = page.viewportSize()
  const dated = await page.getByTestId('event-list').boundingBox()
  const someday = await page.getByRole('complementary', { name: 'Когда-нибудь' }).boundingBox()
  expect(dated).not.toBeNull()
  expect(someday).not.toBeNull()
  if (viewport && viewport.width > 700) {
    expect(someday!.x).toBeGreaterThanOrEqual(dated!.x + dated!.width)
  } else {
    expect(someday!.y).toBeGreaterThanOrEqual(dated!.y + dated!.height)
  }
})

test('экспорт списка: все дедлайны с датами, по возрастанию, с предметом', async ({ page }) => {
  await openDemoList(page)
  await page.getByText('Экспорт списка текстом').click()
  const text = page.getByRole('textbox', { name: 'Список дедлайнов для копирования' })
  await expect(text).toHaveValue(/^1\. \d{2}\.\d{2} /)
  // Дело без даты в экспорт не попадает
  await expect(text).not.toContainText('Физра')
  // Строк столько же, сколько дедлайнов с датой в списке (кроме архива)
  const value = await text.inputValue()
  const listed = await page.getByTestId('event-list').getByRole('listitem').count()
  expect(value.split('\n')).toHaveLength(listed)
})

test('предметы: строка показывает вес и число дедлайнов, правка веса сохраняется', async ({
  page,
}) => {
  await openDemoList(page)
  await page.getByRole('tab', { name: 'Предметы' }).click()
  const rows = page.getByTestId('subjects-list').getByRole('listitem')
  await expect(rows.filter({ hasText: 'Англ. яз.' })).toContainText('Дедлайнов:')
  await rows.filter({ hasText: 'Англ. яз.' }).getByRole('button', { name: 'Изменить' }).click()
  // В режиме правки имя лежит в поле, поэтому строку ищем по кнопке «Сохранить»
  const editing = rows.filter({ has: page.getByRole('button', { name: 'Сохранить' }) })
  await editing.getByLabel('Вес').fill('7')
  await editing.getByRole('button', { name: 'Сохранить' }).click()
  await expect(rows.filter({ hasText: 'Англ. яз.' })).toContainText('Вес 7')
})
