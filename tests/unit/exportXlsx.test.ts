import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog } from '../../src/core/catalog'
import { weekdayColor } from '../../src/core/colors'
import { createEvent, type EventRecord } from '../../src/core/events'
import { createSemester, type Semester } from '../../src/core/model'
import { paintLevels, resolvePalette } from '../../src/core/schedulePalette'
import { defaultSettings } from '../../src/core/settings'
import { buildExportWorkbook, sheetNameFor, type ExportData } from '../../src/excel/exportXlsx'

let n = 0
const { types, levels } = buildDefaultCatalog(() => `id-${++n}`)
const kr = types.find((t) => t.name === 'КР')!
const hackathon = types.find((t) => t.name === 'Хакатон')!

const main: Semester = createSemester(
  { id: 'main', name: 'Осень', startDate: '2026-09-01', endDate: '2027-01-31' },
  '2026-09-01T00:00:00.000Z',
)
const archived: Semester = { ...main, id: 'old', name: 'Старое', archived: true }

function event(overrides: Partial<EventRecord>): EventRecord {
  return {
    ...createEvent(
      {
        title: 'Матан КР',
        typeId: kr.id,
        subjectId: null,
        startDate: '2026-10-21',
        endDate: '2026-10-21',
        time: null,
        importance: null,
        note: '',
        done: false,
      },
      { id: `e-${++n}`, semesterId: main.id },
      '2026-10-01T00:00:00.000Z',
    ),
    ...overrides,
  }
}

const data: ExportData = {
  semesters: [main, archived],
  events: [
    event({ title: 'Матан КР' }),
    event({ title: 'Тест по СИИБД', typeId: types.find((t) => t.name === 'Тест')!.id, startDate: null, endDate: '2026-12-05' }),
    event({ title: 'Хакатон', typeId: hackathon.id, startDate: '2026-11-03', endDate: '2026-11-05' }),
    event({ id: 'old-1', semesterId: archived.id, title: 'Старое дело' }),
  ],
  types,
  levels,
  subjects: [],
  settings: defaultSettings,
  scheduleIds: [main.id, archived.id],
  includeService: true,
  exportedAt: '2026-11-01T12:00:00.000Z',
}

async function reload(workbook: ExcelJS.Workbook): Promise<ExcelJS.Workbook> {
  const buffer = await workbook.xlsx.writeBuffer()
  const loaded = new ExcelJS.Workbook()
  await loaded.xlsx.load(buffer)
  return loaded
}

// Цвет уровня с номером 1 у этого расписания (как в интерфейсе)
const levelOneColor = paintLevels(levels, resolvePalette(null, defaultSettings, levels).levelColors)[0]!.color

describe('buildExportWorkbook: выбор', () => {
  it('выгружаются только выбранные расписания', async () => {
    const wb = await reload(buildExportWorkbook({ ...data, scheduleIds: [main.id] }))
    expect(wb.worksheets.map((ws) => ws.name)).not.toContain('Старое')
    const events = wb.getWorksheet('События')!
    expect(events.rowCount).toBe(1 + 3)
  })

  it('без служебных листов в файле только календари', async () => {
    const wb = await reload(buildExportWorkbook({ ...data, includeService: false }))
    expect(wb.worksheets.map((ws) => ws.name)).toEqual(['Осень', 'Старое'])
  })

  it('служебные листы со всеми данными выбранных расписаний', async () => {
    const wb = await reload(buildExportWorkbook({ ...data, scheduleIds: [main.id] }))
    const names = wb.worksheets.map((ws) => ws.name)
    expect(names).toEqual(
      expect.arrayContaining(['События', 'Типы', 'Уровни', 'Предметы', 'Расписания', 'Настройки', 'Служебный']),
    )
  })
})

describe('buildExportWorkbook: цвета', () => {
  it('месяц и дни недели окрашены цветами сайта, текст читается на заливке', async () => {
    const wb = await reload(buildExportWorkbook({ ...data, scheduleIds: [main.id], includeService: false }))
    const ws = wb.getWorksheet('Осень')!
    const palette = resolvePalette(null, defaultSettings, levels)
    const october = findCell(ws, 'Октябрь 2026').cell
    expect(october.fill).toMatchObject({ fgColor: { argb: argbOf(palette.monthColors[9]!) } })
    // Первое число октября — четверг: колонка 2 в строке с днями недели
    // Название месяца и дни недели стоят в одной строке
    const weekRow = findCell(ws, 'Октябрь 2026').row
    expect(ws.getCell(weekRow, 2).fill).toMatchObject({
      fgColor: { argb: argbOf(weekdayColor(3, palette.weekGradient)) },
    })
  })

  it('ширина дня и масштаб позволяют видеть все 31 день на экране', async () => {
    const wb = await reload(buildExportWorkbook({ ...data, scheduleIds: [main.id], includeService: false }))
    const ws = wb.getWorksheet('Осень')!
    expect(ws.getColumn(2).width).toBeLessThanOrEqual(7)
    expect(ws.views[0]?.zoomScale).toBeLessThanOrEqual(80)
  })
})

describe('buildExportWorkbook: листы', () => {
  it('календарь на каждое выбранное расписание; архив без выбора не попадает, демо не выгружается', async () => {
    const wb = await reload(buildExportWorkbook({ ...data, scheduleIds: [main.id] }))
    const names = wb.worksheets.map((ws) => ws.name)
    expect(names[0]).toBe('Осень')
    expect(names).not.toContain('Старое')
  })

  it('календарь: месяц подписан, дни идут по числам, дедлайн стоит в дне конца с цветом важности', async () => {
    const wb = await reload(buildExportWorkbook(data))
    const ws = wb.getWorksheet('Осень')!
    expect(ws.getCell(1, 2).value).toBe(1)
    expect(ws.getCell(1, 32).value).toBe(31)
    expect(ws.getCell(2, 1).value).toBe('Сентябрь 2026')
    // Октябрь: строка месяца, строка дней недели, потом события. 21 октября — в колонке 22
    const deadline = findCell(ws, 'Матан КР')
    expect(deadline.col).toBe(1 + 21)
    expect(deadline.cell.fill).toMatchObject({ type: 'pattern', fgColor: { argb: argbOf(levelOneColor) } })
  })

  it('фоновый тип занимает весь период одной объединённой полосой', async () => {
    const wb = await reload(buildExportWorkbook(data))
    const ws = wb.getWorksheet('Осень')!
    const hack = findCell(ws, 'Хакатон')
    expect(hack.col).toBe(1 + 3)
    expect(hack.cell.isMerged).toBe(true)
    expect(ws.getCell(hack.row, 1 + 5).isMerged).toBe(true)
  })

  it('список дедлайнов под таблицей: название, дата dd.mm.yyyy, выполнено', async () => {
    const wb = await reload(buildExportWorkbook(data))
    const ws = wb.getWorksheet('Осень')!
    // Название стоит и в календаре (5 декабря), и в списке: нужно последнее совпадение
    const row = findCell(ws, 'Тест по СИИБД', 'last').row
    expect(ws.getCell(row, 5).value).toBe('05.12.2026')
    expect(ws.getCell(row, 6).value).toBe('нет')
  })

  it('служебный лист содержит версию формата и все события, включая архивные', async () => {
    const wb = await reload(buildExportWorkbook(data))
    const service = wb.getWorksheet('Служебный')!
    expect(service.getCell(2, 2).value).toBe('semester-schedule')
    const events = wb.getWorksheet('События')!
    expect(findRow(events, 'Старое дело')).toBeGreaterThan(1)
  })
})

describe('sheetNameFor', () => {
  it('убирает запрещённые символы, режет до 31 знака и не повторяет имена', () => {
    const used = new Set<string>()
    expect(sheetNameFor('Осень: [1]', used)).toBe('Осень   1')
    expect(sheetNameFor('Осень   1', used)).toBe('Осень   1 2')
    expect(sheetNameFor('а'.repeat(40), used).length).toBe(31)
    expect(sheetNameFor('', used)).toBe('Расписание')
  })
})

// Номер строки, где в первом столбце стоит такой текст
function findRow(ws: ExcelJS.Worksheet, text: string): number {
  return findCell(ws, text).row
}

// Первое (или последнее) место, где стоит такой текст
function findCell(
  ws: ExcelJS.Worksheet,
  text: string,
  which: 'first' | 'last' = 'first',
): { row: number; col: number; cell: ExcelJS.Cell } {
  const matches: { row: number; col: number; cell: ExcelJS.Cell }[] = []
  ws.eachRow((row, rowNumber) => {
    row.eachCell((cell, colNumber) => {
      if (cell.value === text) matches.push({ row: rowNumber, col: colNumber, cell })
    })
  })
  const found = which === 'first' ? matches[0] : matches.at(-1)
  if (!found) throw new Error(`Не найдено: ${text}`)
  return found
}

function argbOf(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`
}
