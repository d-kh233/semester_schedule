import { expect, test, type Locator, type Page } from '@playwright/test'
import { openGrid, openList, reloadAndOpenList } from './helpers.js'

// «Сегодня» подставляется явно: 31.10.2026
async function open(page: Page) {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()
  await openList(page)
}

async function saved(page: Page) {
  await expect(page.getByTestId('save-state')).toHaveText('Сохранено')
}

async function switchTo(page: Page, name: string) {
  await page.getByTestId('schedule-select').selectOption({ label: name })
}

const dialog = (page: Page) => page.getByRole('dialog', { name: /^(Новое событие|Событие)$/ })
const row = (page: Page, text: string): Locator =>
  page.getByTestId('event-list').getByRole('listitem').filter({ hasText: text })

async function addEvent(page: Page, title: string, start: string, end = '') {
  await page.getByRole('button', { name: 'Добавить событие' }).click()
  await dialog(page).getByLabel('Название', { exact: true }).fill(title)
  await dialog(page).getByLabel('Начало', { exact: true }).fill(start)
  await dialog(page).getByLabel('Конец', { exact: true }).fill(end || start)
  await dialog(page).getByRole('button', { name: 'Сохранить' }).click()
}

test('личное расписание пусто, в демо есть примеры из ТЗ', async ({ page }) => {
  await open(page)
  await expect(page.getByText('Событий пока нет')).toBeVisible()

  await switchTo(page, 'Демо (демо)')
  const list = page.getByTestId('event-list').getByRole('listitem')
  await expect(list).toHaveCount(10)
  await expect(row(page, 'Хакатон').first()).toContainText('13.10.2026 – 15.11.2026')
  await expect(row(page, 'Англ. яз. тест')).toContainText('13.11.2026 17:00')
  await expect(row(page, 'Физра тест')).toContainText('без даты')
  await expect(row(page, 'Подготовка к экзаменам')).toContainText('15.12.2026 – 31.12.2026')
})

test('порядок в списке: по дате конца, при равной дате КР важнее (GC-4)', async ({ page }) => {
  await open(page)
  await switchTo(page, 'Демо (демо)')
  const titles = await page.getByTestId('event-list').locator('.events__title').allTextContents()
  // 21.10: «Матан КР» (важность 1) выше «СИИБД КР» (ручная важность 3); без даты в конце
  expect(titles.indexOf('Матан КР')).toBeLessThan(titles.indexOf('СИИБД КР'))
  expect(titles.at(-1)).toBe('Физра тест')
  expect(titles[0]).toBe('Матан КР')
})

test('новое событие создаётся кнопкой, видно в списке и после перезагрузки', async ({ page }) => {
  await open(page)
  await addEvent(page, 'Отчёт', '2026-11-10')
  await expect(row(page, 'Отчёт')).toContainText('10.11.2026')
  await saved(page)

  await reloadAndOpenList(page)
  await expect(row(page, 'Отчёт')).toBeVisible()

  // События расписаний не смешиваются
  await switchTo(page, 'Демо (демо)')
  await expect(row(page, 'Отчёт')).toHaveCount(0)
})

test('щелчок по клетке даёт ввод в ячейке на её дату; по серой клетке не даёт', async ({
  page,
}) => {
  await open(page)
  await openGrid(page)
  await page.getByTestId('cell-2026-10-6').click()
  await expect(dialog(page)).toHaveCount(0)
  const cellInput = page.getByTestId('cell-input').getByRole('textbox')
  await expect(cellInput).toBeFocused()
  await cellInput.fill('Встреча')
  await cellInput.press('Enter')
  await expect(page.getByTestId('cell-input')).toHaveCount(0)
  await openList(page)
  await expect(row(page, 'Встреча')).toContainText('06.10.2026')

  await openGrid(page)
  await page.getByTestId('cell-2026-11-31').click()
  await expect(page.getByTestId('cell-input')).toHaveCount(0)
})

test('цвет по важности: тип задаёт важность, ручная перебивает (BR-1, BR-2, BR-3)', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Добавить событие' }).click()
  const card = dialog(page)
  await card.getByLabel('Название', { exact: true }).fill('Контрольная')
  await card.getByLabel('Тип', { exact: true }).selectOption({ label: 'КР' })
  await card.getByLabel('Начало', { exact: true }).fill('2026-11-20')
  await card.getByRole('button', { name: 'Сохранить' }).click()
  const chip = row(page, 'Контрольная').locator('.chip')
  await expect(chip).toHaveAttribute('data-color', '#c0502d')

  await row(page, 'Контрольная').getByRole('button').click()
  await dialog(page).getByLabel('Важность', { exact: true }).selectOption({ label: 'Важность 3' })
  await dialog(page).getByRole('button', { name: 'Сохранить' }).click()
  await expect(chip).toHaveAttribute('data-color', '#f5dcc4')

  // Без типа и важности — бесцветная ячейка (GC-11)
  await addEvent(page, 'Просто дело', '2026-11-21')
  await expect(row(page, 'Просто дело').locator('.chip')).toHaveAttribute('data-color', '')
})

test('хакатон окрашен цветом своего типа', async ({ page }) => {
  await open(page)
  await switchTo(page, 'Демо (демо)')
  await expect(row(page, 'Хакатон').first().locator('.chip')).toHaveAttribute(
    'data-color',
    '#f0a03c',
  )
})

test('название строится из предмета и типа; новый предмет создаётся в карточке', async ({
  page,
}) => {
  await open(page)
  await page.getByRole('button', { name: 'Добавить событие' }).click()
  const card = dialog(page)
  // Типы идут в заданном порядке
  await expect(card.getByLabel('Тип', { exact: true }).locator('option')).toHaveText([
    'Без типа',
    'КР',
    'Практика',
    'Тест',
    'Хакатон',
    'Подготовка к экзаменам',
  ])
  // В личном расписании предметов демо нет
  await expect(card.getByLabel('Предмет', { exact: true }).locator('option')).toHaveText([
    'Без предмета',
    'Новый предмет…',
  ])
  await card.getByLabel('Предмет', { exact: true }).selectOption({ label: 'Новый предмет…' })
  await card.getByRole('button', { name: 'Добавить предмет' }).click()
  await expect(card.getByRole('alert')).toHaveText('Введите полное имя предмета.')
  await card.getByLabel('Полное имя предмета').fill('Матан')
  await card.getByLabel('Короткое имя (для строки ввода)').fill('ма тан')
  await card.getByRole('button', { name: 'Добавить предмет' }).click()
  await expect(card.getByRole('alert')).toHaveText(
    'Короткое имя должно быть одним словом, без пробелов.',
  )
  await card.getByLabel('Короткое имя (для строки ввода)').fill('матан')
  await card.getByRole('button', { name: 'Добавить предмет' }).click()
  await expect(card.getByLabel('Предмет', { exact: true }).locator('option:checked')).toHaveText(
    'Матан',
  )

  await card.getByLabel('Тип', { exact: true }).selectOption({ label: 'КР' })
  await card.getByLabel('Начало', { exact: true }).fill('2026-11-25')
  await card.getByRole('button', { name: 'Сохранить' }).click()
  await expect(row(page, 'Матан КР')).toContainText('Матан · КР · 25.11.2026')
  await saved(page)

  // Предмет остаётся после перезагрузки, но в демо его нет
  await reloadAndOpenList(page)
  await expect(row(page, 'Матан КР')).toBeVisible()
  await switchTo(page, 'Демо (демо)')
  await page.getByRole('button', { name: 'Добавить событие' }).click()
  await expect(
    dialog(page).getByLabel('Предмет', { exact: true }).locator('option'),
  ).toHaveText(['Без предмета', 'Англ. яз.', 'Матан', 'СИИБД', 'Физра', 'Новый предмет…'])
})

test('ошибки в карточке: окно не закрывается, ничего не создаётся', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Добавить событие' }).click()
  const card = dialog(page)
  await card.getByRole('button', { name: 'Сохранить' }).click()
  await expect(card.getByRole('alert')).toHaveText('Введите название или выберите предмет и тип.')

  await card.getByLabel('Название', { exact: true }).fill('Тест')
  await card.getByLabel('Начало', { exact: true }).fill('2026-11-15')
  await card.getByLabel('Конец', { exact: true }).fill('2026-10-13')
  await card.getByRole('button', { name: 'Сохранить' }).click()
  await expect(card.getByRole('alert')).toHaveText('Конец раньше начала.')
  await expect(card).toBeVisible()

  await card.getByRole('button', { name: 'Отмена' }).click()
  await expect(card).toHaveCount(0)
  await expect(page.getByText('Событий пока нет')).toBeVisible()
})

test('Esc закрывает карточку без сохранения', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Добавить событие' }).click()
  await dialog(page).getByLabel('Название', { exact: true }).fill('Не сохранять')
  await page.keyboard.press('Escape')
  await expect(dialog(page)).toHaveCount(0)
  await expect(page.getByText('Событий пока нет')).toBeVisible()
})

test('правка события: изменения сохраняются, остальные поля остаются', async ({ page }) => {
  await open(page)
  await switchTo(page, 'Демо (демо)')
  await row(page, 'Англ. яз. тест').getByRole('button').click()
  const card = dialog(page)
  await expect(card.getByLabel('Название', { exact: true })).toHaveValue('Англ. яз. тест')
  await expect(card.getByLabel('Время', { exact: true })).toHaveValue('17:00')
  await card.getByLabel('Название', { exact: true }).fill('Англ. яз. зачёт')
  await card.getByLabel('Заметка', { exact: true }).fill('взять словарь')
  await card.getByRole('button', { name: 'Сохранить' }).click()
  await expect(row(page, 'Англ. яз. зачёт')).toContainText('Англ. яз. · Тест · 13.11.2026 17:00')
  await saved(page)

  await reloadAndOpenList(page)
  await switchTo(page, 'Демо (демо)')
  await row(page, 'Англ. яз. зачёт').getByRole('button').click()
  await expect(dialog(page).getByLabel('Заметка', { exact: true })).toHaveValue('взять словарь')
})

test('галочка «Выполнено» помечает событие', async ({ page }) => {
  await open(page)
  await addEvent(page, 'Сдать долг', '2026-11-12')
  await row(page, 'Сдать долг').getByRole('button').click()
  await dialog(page).getByLabel('Выполнено').check()
  await dialog(page).getByRole('button', { name: 'Сохранить' }).click()
  await expect(row(page, 'Сдать долг')).toContainText('выполнено')
  await saved(page)

  await reloadAndOpenList(page)
  await expect(row(page, 'Сдать долг')).toContainText('выполнено')
})

test('LC-6: архив скрывает событие из списка и возвращает его обратно', async ({ page }) => {
  await open(page)
  await addEvent(page, 'Старое дело', '2026-11-12')
  await row(page, 'Старое дело').getByRole('button').click()
  await dialog(page).getByRole('button', { name: 'В архив' }).click()
  await expect(row(page, 'Старое дело')).toHaveCount(0)
  await expect(page.getByTestId('event-archive')).toContainText('Старое дело')
  await saved(page)

  await reloadAndOpenList(page)
  await expect(page.getByTestId('event-archive')).toContainText('Старое дело')

  await page.getByTestId('event-archive').getByRole('button', { name: 'Вернуть' }).click()
  await expect(row(page, 'Старое дело')).toBeVisible()
  await expect(page.locator('.events').getByText('Архив пуст')).toBeVisible()
})

test('LC-7: удаление только после подтверждения; удалённое демо-событие не появляется заново', async ({
  page,
}) => {
  await open(page)
  await switchTo(page, 'Демо (демо)')
  await row(page, 'Физра тест').getByRole('button').click()

  await dialog(page).getByRole('button', { name: 'Удалить' }).click()
  await expect(dialog(page).getByText('Удалить событие навсегда?')).toBeVisible()
  // Отказ: событие на месте
  await dialog(page).getByRole('button', { name: 'Нет, оставить' }).click()
  await expect(dialog(page).getByText('Удалить событие навсегда?')).toHaveCount(0)
  await dialog(page).getByRole('button', { name: 'Отмена' }).click()
  await expect(row(page, 'Физра тест')).toBeVisible()

  // Подтверждение: событие удалено
  await row(page, 'Физра тест').getByRole('button').click()
  await dialog(page).getByRole('button', { name: 'Удалить' }).click()
  await dialog(page).getByRole('button', { name: 'Да, удалить навсегда' }).click()
  await expect(row(page, 'Физра тест')).toHaveCount(0)
  await expect(page.getByTestId('event-archive')).toHaveCount(0)
  await saved(page)

  await reloadAndOpenList(page)
  await switchTo(page, 'Демо (демо)')
  await expect(page.getByTestId('event-list').getByRole('listitem')).toHaveCount(9)
  await expect(row(page, 'Физра тест')).toHaveCount(0)
})

test('база версии 1 (шаг 3а) обновляется до версии 2 без потери данных', async ({ page }) => {
  // Открываем страницу того же сайта без приложения и создаём базу как на шаге 3а
  await page.goto('/favicon.svg')
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('semester-schedule', 1)
        req.onupgradeneeded = () => {
          req.result.createObjectStore('semesters', { keyPath: 'id' })
          req.result.createObjectStore('settings')
          req.result.createObjectStore('meta')
        }
        req.onerror = () => reject(req.error)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction(['semesters', 'meta'], 'readwrite')
          tx.objectStore('semesters').put({
            id: 'old-1',
            name: 'Старое расписание',
            startDate: '2027-02-01',
            endDate: '2027-06-30',
            weekOneMonday: '2027-02-08',
            columnWidths: Array<number>(31).fill(40),
            monthColumnWidth: 120,
            isDemo: false,
            archived: false,
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
          })
          tx.objectStore('meta').put('old-1', 'activeSemesterId')
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error)
        }
      }),
  )

  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2027-02')).toBeVisible()
  await expect(page.getByTestId('schedule-select').locator('option')).toHaveText([
    'Старое расписание',
  ])
  await expect(page.getByTestId('weeknum-2027-02-08')).toHaveText('1')
  expect((await page.getByTestId('head-5').boundingBox())?.width).toBe(40)
  await openList(page)

  // Новые возможности работают на старой базе
  await addEvent(page, 'Новое дело', '2027-02-10')
  await expect(row(page, 'Новое дело')).toBeVisible()
  await saved(page)
  await reloadAndOpenList(page)
  await expect(row(page, 'Новое дело')).toBeVisible()
  await openGrid(page)
  await expect(page.getByTestId('weeknum-2027-02-08')).toHaveText('1')
})
