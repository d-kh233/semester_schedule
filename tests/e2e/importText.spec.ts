import { expect, test, type Locator, type Page } from '@playwright/test'
import { openList } from './helpers.js'

// «Сегодня» подставляется явно: 31.10.2026 (суббота), как в quickinput.spec.ts
async function openDemoList(page: Page) {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })
  await openList(page)
  await expect(eventRows(page)).toHaveCount(10)
}

const eventRows = (page: Page) => page.locator('[data-testid="event-list"], [data-testid="someday-list"]').getByRole('listitem')
const row = (page: Page, text: string): Locator => eventRows(page).filter({ hasText: text })
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Импорт текстом' })
const textBox = (page: Page) => dialog(page).getByRole('textbox', { name: 'Импорт текстом' })
const preview = (page: Page) => dialog(page).getByTestId('import-preview')
const addButton = (page: Page) => dialog(page).getByRole('button', { name: 'Добавить' })

async function openImport(page: Page, text: string) {
  await page.getByRole('button', { name: 'Импорт текстом' }).click()
  await expect(dialog(page)).toBeVisible()
  await textBox(page).fill(text)
}

async function closeImport(page: Page) {
  await dialog(page).getByRole('button', { name: 'Закрыть' }).click()
  await expect(dialog(page)).toHaveCount(0)
}

test('вставка: предпросмотр, «Добавить» записывает, список обновляется', async ({ page }) => {
  await openDemoList(page)
  await openImport(page, 'Матан\n\n1) КР 4 14.12\n2. тест 15.12')
  await expect(preview(page).getByRole('listitem')).toHaveCount(2)
  await expect(preview(page)).toContainText('Матан КР 4, 14.12.2026')
  await expect(preview(page)).toContainText('Матан Тест, 15.12.2026')

  await addButton(page).click()
  await expect(dialog(page)).toContainText('Создано: 2, обновлено: 0.')
  await closeImport(page)
  await expect(eventRows(page)).toHaveCount(12)
  await expect(row(page, 'Матан КР 4')).toBeVisible()
})

test('«Отменить всю вставку» убирает всё, что записала эта вставка', async ({ page }) => {
  await openDemoList(page)
  await openImport(page, 'Матан\nКР 4 14.12\nтест 15.12')
  await addButton(page).click()
  await expect(eventRows(page)).toHaveCount(12)

  await dialog(page).getByRole('button', { name: 'Отменить всю вставку' }).click()
  await expect(dialog(page)).toContainText('Вставка отменена.')
  await closeImport(page)
  await expect(eventRows(page)).toHaveCount(10)
})

test('TC-20 при импорте: та же дата и название — строка обновляет событие, новое не создаётся', async ({
  page,
}) => {
  await openDemoList(page)
  await openImport(page, 'Матан\n2 КР 21.10')
  await expect(preview(page)).toContainText('обновить')
  await addButton(page).click()
  await expect(dialog(page)).toContainText('Создано: 0, обновлено: 1.')
  await closeImport(page)
  await expect(eventRows(page)).toHaveCount(10)
  await expect(
    row(page, 'Матан КР').filter({ hasText: '21.10.2026' }).locator('.chip'),
  ).toHaveAttribute('data-color', '#f6d98f')
})

test('ошибка в одной строке видна, остальные строки записываются', async ({ page }) => {
  await openDemoList(page)
  await openImport(page, 'Матан\nКР 32.10\nтест 16.12')
  await expect(preview(page).getByRole('listitem')).toHaveCount(2)
  await expect(preview(page)).toContainText('Такой даты нет: «32.10».')
  await expect(preview(page)).toContainText('Матан Тест, 16.12.2026')

  await addButton(page).click()
  await expect(dialog(page)).toContainText('Создано: 1, обновлено: 0.')
  await closeImport(page)
  await expect(eventRows(page)).toHaveCount(11)
})

test('неизвестный предмет: кнопка создаёт предмет, строки становятся верными', async ({
  page,
}) => {
  await openDemoList(page)
  await openImport(page, 'Хим\nтест 16.12')
  await expect(preview(page)).toContainText('Предмета «Хим» нет.')

  await dialog(page).getByRole('button', { name: 'Создать предмет «Хим»' }).click()
  await expect(preview(page)).not.toContainText('Предмета «Хим» нет.')
  await expect(preview(page)).toContainText('Хим Тест, 16.12.2026')

  await addButton(page).click()
  await closeImport(page)
  await expect(row(page, 'Хим Тест')).toBeVisible()
})

test('шаблон для ИИ с примером есть в окне', async ({ page }) => {
  await openDemoList(page)
  await page.getByRole('button', { name: 'Импорт текстом' }).click()
  await dialog(page).getByText('Шаблон для ИИ').click()
  await expect(dialog(page).getByRole('textbox', { name: 'Шаблон для ИИ' })).toHaveValue(
    /преобразуй моё расписание в этот формат:[\s\S]*КР 1 21\.10/,
  )
})
