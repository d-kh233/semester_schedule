import { expect, test, type Page } from '@playwright/test'
import { closeSettings, openSettings } from './helpers.js'

// «Сегодня» подставляется явно: 31.10.2026
async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
}

const typeRows = (page: Page) => page.locator('li[data-testid^="type-row-"]')
const levelRows = (page: Page) => page.locator('li[data-testid^="level-row-"]')
const addForm = (page: Page) => page.locator('.catalog__add')

async function addType(page: Page, name: string, keywords: string) {
  await addForm(page).getByPlaceholder('Название нового типа').fill(name)
  await addForm(page).getByPlaceholder('Слова для ввода, например: лаб, лаба').fill(keywords)
  await addForm(page).getByRole('button', { name: 'Добавить тип' }).click()
}

test('свой тип: добавить, переименовать, удалить с подтверждением', async ({ page }) => {
  await open(page)
  await openSettings(page)
  await expect(typeRows(page)).toHaveCount(5)

  await addType(page, 'Лабораторная', 'лаб, лаба')
  await expect(typeRows(page)).toHaveCount(6)

  const row = typeRows(page).last()
  await expect(row.getByRole('textbox', { name: 'Название типа', exact: true })).toHaveValue('Лабораторная')
  await row.getByRole('textbox', { name: 'Название типа', exact: true }).fill('Лабораторная работа')
  await row.getByRole('textbox', { name: 'Название типа', exact: true }).press('Enter')

  await row.getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(row.getByRole('button', { name: 'Да, удалить' })).toBeVisible()
  await row.getByRole('button', { name: 'Да, удалить' }).click()
  await expect(typeRows(page)).toHaveCount(5)
})

test('стандартный тип нельзя удалить, его видно как «стандартный»', async ({ page }) => {
  await open(page)
  await openSettings(page)
  const first = typeRows(page).first()
  await expect(first.getByText('стандартный')).toBeVisible()
  await expect(first.getByRole('button', { name: 'Удалить', exact: true })).toHaveCount(0)
})

test('ключевое слово, занятое другим типом, не принимается', async ({ page }) => {
  await open(page)
  await openSettings(page)
  await addType(page, 'Доклад', 'кр')
  await expect(addForm(page).getByRole('alert')).toHaveText('Такое название или слово уже занято.')
  await expect(typeRows(page)).toHaveCount(5)
})

test('уровни: стандартный 1 нельзя удалить, новый уровень 4 добавляется и удаляется', async ({ page }) => {
  await open(page)
  await openSettings(page)
  await expect(levelRows(page)).toHaveCount(3)
  await expect(levelRows(page).first().getByText('стандартный')).toBeVisible()

  await page.getByRole('button', { name: 'Добавить уровень' }).click()
  await expect(levelRows(page)).toHaveCount(4)

  const level4 = page.locator('li[data-testid="level-row-4"]')
  await level4.getByRole('button', { name: 'Удалить', exact: true }).click()
  await level4.getByRole('button', { name: 'Да, удалить' }).click()
  await expect(levelRows(page)).toHaveCount(3)
})

test('добавленный тип сохраняется после перезагрузки', async ({ page }) => {
  await open(page)
  await openSettings(page)
  await addType(page, 'Коллоквиум', 'колл')
  await expect(typeRows(page)).toHaveCount(6)
  await closeSettings(page)
  await expect(page.getByTestId('save-state')).toHaveText('Сохранено')

  await page.reload()
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
  await openSettings(page)
  await expect(typeRows(page)).toHaveCount(6)
  await expect(typeRows(page).last().getByRole('textbox', { name: 'Название типа', exact: true })).toHaveValue('Коллоквиум')
})
