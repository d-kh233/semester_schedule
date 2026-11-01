import { expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { tmpdir } from 'os'
import { join } from 'path'
import { closeSettings, openSettings, settingsDialog } from './helpers.js'

// «Сегодня» подставляется явно: 31.10.2026, как в других сценариях
test('выгрузка в Excel: дедлайн стоит в дне конца, файл скачивается', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()

  const input = page.getByRole('textbox', { name: 'Строка ввода' })
  await input.fill('кр 21.10')
  await input.press('Enter')
  await expect(page.getByTestId('save-state')).toHaveText('Сохранено')

  await openSettings(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Экспорт в Excel' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^расписание-\d{4}-\d{2}-\d{2}\.xlsx$/)

  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile((await download.path())!)
  const calendar = workbook.worksheets[0]!
  // 21 октября — колонка 22 (B — первое число); дедлайн лежит в той же строке
  let found = false
  calendar.eachRow((row) => {
    const cell = row.getCell(22)
    if (typeof cell.value === 'string' && /кр/i.test(cell.value)) found = true
  })
  expect(found).toBe(true)

  await closeSettings(page)
})

// Загрузка того же файла обратно: ничего нового, дубликатов нет
test('загрузка выгрузки обратно: тот же файл не создаёт дубликатов', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()

  const input = page.getByRole('textbox', { name: 'Строка ввода' })
  await input.fill('кр 21.10')
  await input.press('Enter')
  await expect(page.getByTestId('save-state')).toHaveText('Сохранено')

  await openSettings(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Экспорт в Excel' }).click(),
  ])
  const path = (await download.path())!

  await settingsDialog(page).getByLabel('Выбрать файл').setInputFiles(path)
  await expect(settingsDialog(page).getByText('В файле нет новых или изменённых записей.')).toBeVisible()
  await expect(settingsDialog(page).getByRole('button', { name: 'Загрузить' })).toBeDisabled()
  await closeSettings(page)
})

// Новая строка в листе «События» загружается и не трогает остальное
test('загрузка новой строки из выгрузки добавляет одно событие', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') })
  await page.goto('/')
  await expect(page.getByTestId('month-2026-09')).toBeVisible()

  await openSettings(page)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Экспорт в Excel' }).click(),
  ])
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile((await download.path())!)
  const semesterId = workbook.getWorksheet('Расписания')!.getCell(2, 1).value as string
  workbook
    .getWorksheet('События')!
    .addRow([
      'restore-1', semesterId, 'Из файла', '', '', '2026-12-01', '2026-12-01', '', '', '', '', 'нет', 'нет', '[]',
      '2026-10-31T10:00:00.000Z', '2026-10-31T10:00:00.000Z',
    ])
  const edited = join(tmpdir(), `restore-${Date.now()}.xlsx`)
  await workbook.xlsx.writeFile(edited)

  await settingsDialog(page).getByLabel('Выбрать файл').setInputFiles(edited)
  await expect(settingsDialog(page).getByText('Добавится: 1, обновится: 0, пропущено строк: 0.')).toBeVisible()
  await settingsDialog(page).getByRole('button', { name: 'Загрузить' }).click()
  await expect(settingsDialog(page).getByText('Загружено: добавлено 1, обновлено 0.')).toBeVisible()
  await closeSettings(page)
})
