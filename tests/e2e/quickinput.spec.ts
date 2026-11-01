import { expect, test, type Locator, type Page } from '@playwright/test'
import { openList, reloadAndOpenList } from './helpers.js'

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
  await expect(eventRows(page)).toHaveCount(10)
}

async function saved(page: Page) {
  await expect(page.getByTestId('save-state')).toHaveText('Сохранено')
}

const input = (page: Page) => page.getByRole('textbox', { name: 'Строка ввода' })
const toast = (page: Page) => page.getByTestId('input-toast')
const issue = (page: Page) => page.getByTestId('input-issue')
const eventRows = (page: Page) => page.locator('[data-testid="event-list"], [data-testid="someday-list"]').getByRole('listitem')
const row = (page: Page, text: string): Locator => eventRows(page).filter({ hasText: text })

async function enter(page: Page, text: string) {
  await input(page).fill(text)
  await input(page).press('Enter')
}

test('Enter создаёт событие, оно сразу в списке и остаётся после перезагрузки', async ({ page }) => {
  await openDemo(page)
  await enter(page, '1 матан кр 22.10')
  await expect(toast(page)).toContainText('Создано: Матан КР, 22.10.2026')
  await expect(eventRows(page)).toHaveCount(11)
  await expect(input(page)).toHaveValue('')
  await saved(page)

  await reloadAndOpenList(page)
  await expect(eventRows(page)).toHaveCount(11)
  await expect(row(page, 'Матан КР').filter({ hasText: '22.10.2026' })).toBeVisible()
})

test('Enter не вставляет перенос строки; пустой ввод ничего не делает', async ({ page }) => {
  await openDemo(page)
  await input(page).press('Enter')
  await expect(toast(page)).toHaveCount(0)
  await expect(issue(page)).toHaveCount(0)
  await expect(input(page)).toHaveValue('')

  await input(page).fill('матан кр 22.10')
  await input(page).press('Enter')
  await expect(input(page)).toHaveValue('')
})

test('кнопка «Отменить» убирает только что созданное событие', async ({ page }) => {
  await openDemo(page)
  await enter(page, '1 матан кр 22.10')
  await expect(eventRows(page)).toHaveCount(11)
  await toast(page).getByRole('button', { name: 'Отменить' }).click()
  await expect(toast(page)).toContainText('Отменено')
  await expect(eventRows(page)).toHaveCount(10)
  await saved(page)

  await reloadAndOpenList(page)
  await expect(eventRows(page)).toHaveCount(10)
})

test('TC-20: тот же предмет, дата и название — событие обновляется, а не создаётся', async ({
  page,
}) => {
  await openDemo(page)
  const target = row(page, 'Матан КР').filter({ hasText: '21.10.2026' })
  await expect(target.locator('.chip')).toHaveAttribute('data-color', '#c0502d')

  await enter(page, '2 матан кр 21.10')
  await expect(toast(page)).toContainText('Обновлено: Матан КР, 21.10.2026')
  await expect(eventRows(page)).toHaveCount(10)
  await expect(target.locator('.chip')).toHaveAttribute('data-color', '#f6d98f')

  // «Отменить» возвращает прежнюю важность
  await toast(page).getByRole('button', { name: 'Отменить' }).click()
  await expect(target.locator('.chip')).toHaveAttribute('data-color', '#c0502d')
  await expect(eventRows(page)).toHaveCount(10)
})

test('TC-21: другая дата — новое событие, старое не меняется', async ({ page }) => {
  await openDemo(page)
  await enter(page, '2 матан кр 22.10')
  await expect(eventRows(page)).toHaveCount(11)
  await expect(
    row(page, 'Матан КР').filter({ hasText: '21.10.2026' }).locator('.chip'),
  ).toHaveAttribute('data-color', '#c0502d')
  await expect(
    row(page, 'Матан КР').filter({ hasText: '22.10.2026' }).locator('.chip'),
  ).toHaveAttribute('data-color', '#f6d98f')
})

test('правка текстом: время добавляется к существующему событию', async ({ page }) => {
  await openDemo(page)
  await enter(page, 'матан кр 21.10 17:00')
  await expect(toast(page)).toContainText('Обновлено')
  await expect(eventRows(page)).toHaveCount(10)
  await expect(row(page, 'Матан КР').filter({ hasText: '21.10.2026 17:00' })).toBeVisible()
})

test('TC-22, TC-24: несколько событий через «;» и через новую строку', async ({ page }) => {
  await openDemo(page)
  await enter(page, '1 матан кр 22.10; 2 англ тест 23.10')
  await expect(eventRows(page)).toHaveCount(12)
  await expect(toast(page)).toContainText('Создано: Матан КР, 22.10.2026')
  await expect(toast(page)).toContainText('Создано: Англ. яз. Тест, 23.10.2026')

  await input(page).fill('1 матан кр 24.10')
  await input(page).press('Shift+Enter')
  await input(page).pressSequentially('2 англ тест 25.10')
  await expect(input(page)).toHaveValue('1 матан кр 24.10\n2 англ тест 25.10')
  await input(page).press('Enter')
  await expect(eventRows(page)).toHaveCount(14)
})

test('TC-11: «завтра» — дата считается от сегодняшнего дня', async ({ page }) => {
  await openDemo(page)
  await enter(page, 'англ тест завтра')
  await expect(toast(page)).toContainText('Создано: Англ. яз. Тест, 01.11.2026')
})

test('TC-16, TC-17: ошибки не создают события и не теряют набранное', async ({ page }) => {
  await openDemo(page)
  await enter(page, '21.10')
  await expect(issue(page)).toContainText('Нет названия')
  await expect(input(page)).toHaveValue('21.10')
  await expect(eventRows(page)).toHaveCount(10)
  await issue(page).getByRole('button', { name: 'ок' }).click()
  await expect(issue(page)).toHaveCount(0)
  await expect(input(page)).toHaveValue('21.10')

  await enter(page, 'матан кр 32.10')
  await expect(issue(page)).toContainText('Такой даты нет: «32.10».')
  await expect(eventRows(page)).toHaveCount(10)

  await enter(page, 'матан кр 21.10 25:00')
  await expect(issue(page)).toContainText('Неверное время: «25:00»')
  await expect(eventRows(page)).toHaveCount(10)
})

test('смешанный ввод: верная часть создаётся, неверная остаётся в строке', async ({ page }) => {
  await openDemo(page)
  await enter(page, '1 матан кр 22.10; 21.10')
  await expect(toast(page)).toContainText('Создано: Матан КР, 22.10.2026')
  await expect(eventRows(page)).toHaveCount(11)
  await expect(issue(page)).toContainText('Нет названия')
  await expect(input(page)).toHaveValue('21.10')
})

test('TC-18: конец раньше начала — даты меняются местами только после «ок»', async ({ page }) => {
  await openDemo(page)
  await enter(page, 'хакатон 20.12–10.12')
  await expect(issue(page)).toContainText('Конец раньше начала. Поменять даты местами?')
  await expect(eventRows(page)).toHaveCount(10)

  await issue(page).getByRole('button', { name: 'ок' }).click()
  await expect(toast(page)).toContainText('Создано: Хакатон, 10.12.2026 – 20.12.2026')
  await expect(eventRows(page)).toHaveCount(11)
  await expect(issue(page)).toHaveCount(0)
  await expect(input(page)).toHaveValue('')
})

test('TC-18: отказ от обмена дат ничего не создаёт, строка остаётся', async ({ page }) => {
  await openDemo(page)
  await enter(page, 'хакатон 20.12–10.12')
  await issue(page).getByRole('button', { name: 'Отмена' }).click()
  await expect(issue(page)).toHaveCount(0)
  await expect(eventRows(page)).toHaveCount(10)
  await expect(input(page)).toHaveValue('хакатон 20.12–10.12')
})

test('TC-15: уровня 5 нет — выбрать существующий', async ({ page }) => {
  await openDemo(page)
  await enter(page, '5 матан кр 22.10')
  await expect(issue(page)).toContainText('Уровня 5 нет')
  await expect(eventRows(page)).toHaveCount(10)
  for (const label of ['Создать уровень 5', 'Выбрать 1', 'Выбрать 2', 'Выбрать 3']) {
    await expect(issue(page).getByRole('button', { name: label })).toBeVisible()
  }
  await issue(page).getByRole('button', { name: 'Выбрать 3' }).click()
  await expect(toast(page)).toContainText('Создано: Матан КР, 22.10.2026')
  await expect(
    row(page, 'Матан КР').filter({ hasText: '22.10.2026' }).locator('.chip'),
  ).toHaveAttribute('data-color', '#f5dcc4')
})

test('TC-15: уровня 5 нет — создать уровень, он появится и в карточке', async ({ page }) => {
  await openDemo(page)
  await enter(page, '5 матан кр 22.10')
  await issue(page).getByRole('button', { name: 'Создать уровень 5' }).click()
  await expect(toast(page)).toContainText('Создано: Матан КР, 22.10.2026')
  const chip = row(page, 'Матан КР').filter({ hasText: '22.10.2026' }).locator('.chip')
  await expect(chip).toHaveAttribute('data-color', '#bfbfbf')
  await saved(page)

  await reloadAndOpenList(page)
  await expect(chip).toHaveAttribute('data-color', '#bfbfbf')
  await row(page, 'Матан КР').filter({ hasText: '22.10.2026' }).getByRole('button').click()
  await expect(
    page.getByRole('dialog').getByLabel('Важность', { exact: true }).locator('option'),
  ).toHaveText(['По типу', 'Важность 1', 'Важность 2', 'Важность 3', 'Важность 4', 'Важность 5'])
})

test('TC-19: неизвестный предмет — добавить событие без предмета', async ({ page }) => {
  await openDemo(page)
  await enter(page, 'хим тест 24.10')
  await expect(issue(page)).toContainText('Предмета «хим» нет.')
  await expect(eventRows(page)).toHaveCount(10)
  await issue(page).getByRole('button', { name: 'Добавить без предмета' }).click()
  await expect(toast(page)).toContainText('Создано: хим, 24.10.2026')
  await expect(eventRows(page)).toHaveCount(11)
})

test('TC-19: неизвестный предмет — создать предмет, дальше он понимается сам', async ({ page }) => {
  await openDemo(page)
  await enter(page, 'хим тест 25.10')
  await issue(page).getByRole('button', { name: 'Создать предмет' }).click()
  await expect(page.getByLabel('Полное имя предмета')).toHaveValue('Хим')
  await page.getByLabel('Полное имя предмета').fill('')
  await issue(page).getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(issue(page)).toContainText('Введите полное имя предмета.')
  await expect(eventRows(page)).toHaveCount(10)

  await page.getByLabel('Полное имя предмета').fill('Химия')
  await issue(page).getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(toast(page)).toContainText('Создано: Химия Тест, 25.10.2026')
  await expect(eventRows(page)).toHaveCount(11)
  await expect(issue(page)).toHaveCount(0)

  await enter(page, 'хим кр 26.10')
  await expect(toast(page)).toContainText('Создано: Химия КР, 26.10.2026')
  await expect(issue(page)).toHaveCount(0)
  await saved(page)

  await reloadAndOpenList(page)
  await enter(page, 'хим кр 27.10')
  await expect(toast(page)).toContainText('Создано: Химия КР, 27.10.2026')
})

test('в личном расписании предметов нет: «матан» предлагается создать и дальше работает', async ({
  page,
}) => {
  await open(page)
  await openList(page)
  await enter(page, 'матан кр 21.10')
  await expect(issue(page)).toContainText('Предмета «матан» нет.')
  await issue(page).getByRole('button', { name: 'Создать предмет' }).click()
  await page.getByLabel('Полное имя предмета').fill('Математика')
  await issue(page).getByRole('button', { name: 'Создать', exact: true }).click()
  await expect(toast(page)).toContainText('Создано: Математика КР, 21.10.2026')
  await expect(eventRows(page)).toHaveCount(1)

  await enter(page, 'матан тест 22.10')
  await expect(toast(page)).toContainText('Создано: Математика Тест, 22.10.2026')
  await expect(issue(page)).toHaveCount(0)
})

test('TC-8: практика с двумя окнами: планируемое самое раннее, людное помечено', async ({
  page,
}) => {
  await openDemo(page)
  await enter(page, 'практика сиибд 10.12, 28.12')
  await expect(toast(page)).toContainText('Создано: СИИБД Практика, 10.12.2026')
  const created = row(page, 'СИИБД Практика')
  await expect(created).toContainText('окна: 10.12.2026 (планируемое), 28.12.2026 (людное)')
  await saved(page)

  await reloadAndOpenList(page)
  await expect(row(page, 'СИИБД Практика')).toContainText(
    'окна: 10.12.2026 (планируемое), 28.12.2026 (людное)',
  )

  // Правка через карточку не теряет окна
  await row(page, 'СИИБД Практика').getByRole('button').click()
  await page.getByRole('dialog').getByLabel('Заметка', { exact: true }).fill('заметка')
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить' }).click()
  await expect(row(page, 'СИИБД Практика')).toContainText('28.12.2026 (людное)')
})

test('несколько дат через запятую у не-практики — ошибка', async ({ page }) => {
  await openDemo(page)
  await enter(page, 'матан кр 21.10, 22.10')
  await expect(issue(page)).toContainText('Несколько дат через запятую можно только у практики.')
  await expect(eventRows(page)).toHaveCount(10)
})

test('TC-10: без даты — событие создаётся и показывается как «без даты»', async ({ page }) => {
  await openDemo(page)
  await enter(page, 'англ тест')
  await expect(toast(page)).toContainText('Создано: Англ. яз. Тест, без даты')
  await expect(page.getByTestId('someday-list')).toContainText('Англ. яз. Тест')
})

test('переключение расписаний не даёт ошибок в консоли и дубликатов на странице', async ({ page }) => {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(message.text())
  })
  page.on('pageerror', (error) => problems.push(String(error)))

  await open(page)
  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })
  await openList(page)
  await expect(eventRows(page)).toHaveCount(10)
  await page.getByTestId('schedule-select').selectOption({ label: 'Моё расписание' })
  await page.getByTestId('schedule-select').selectOption({ label: 'Демо (демо)' })

  await expect(input(page)).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Настройки' })).toHaveCount(1)
  expect(problems).toEqual([])
})
