import { expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'
import { closeSettings, openSettings } from './helpers.js'

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
