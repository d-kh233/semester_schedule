// Выгрузка в Excel: календари выбранных расписаний и служебные листы с их данными.
// Листы с данными нужны для восстановления (загрузка обратно появится позже).

import ExcelJS from 'exceljs'
import { contrastText } from '../core/colors'
import type { EventType, ImportanceLevel, Subject } from '../core/catalog'
import { formatDateRu } from '../core/dates'
import {
  buildDeadlineList,
  buildExportCalendar,
  type DeadlineListItem,
  type ExportCalendar,
} from '../core/exportLayout'
import type { EventRecord } from '../core/events'
import { sortSemesters, type Semester } from '../core/model'
import { paintLevels, resolvePalette } from '../core/schedulePalette'
import type { Settings } from '../core/settings'
import { ru } from '../i18n/ru'

export const EXPORT_FORMAT = 'semester-schedule'
export const EXPORT_FORMAT_VERSION = 1

const DAY_COLUMNS = 31
const FIRST_DAY_COLUMN = 2
// Ширины подобраны так, чтобы все 31 день помещались на экране ноутбука при масштабе 70%
const MONTH_COLUMN_WIDTH = 12
const DAY_COLUMN_WIDTH = 6.5
const ZOOM = 70
const FONT_SIZE = 9
const LINE_HEIGHT = 12
// Примерно столько символов влезает в строку клетки шириной DAY_COLUMN_WIDTH
const CHARS_PER_LINE = 7
const GREY = '#E7E6E6'
const SHEET_NAME_LIMIT = 31
const FORBIDDEN_SHEET_CHARS = /[[\]:*?/\\]/g

export interface ExportData {
  semesters: Semester[]
  events: EventRecord[]
  types: EventType[]
  levels: ImportanceLevel[]
  subjects: Subject[]
  settings: Settings
  // Какие расписания выгружать (календарь и их данные в служебных листах)
  scheduleIds: string[]
  // Служебные листы для восстановления
  includeService: boolean
  // Момент выгрузки строкой ISO (передаёт интерфейс)
  exportedAt: string
}

function argb(hex: string): string {
  return `FF${hex.replace('#', '').toUpperCase()}`
}

function fill(hex: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } }
}

function yesNo(value: boolean): string {
  return value ? ru.excel.yes : ru.excel.no
}

function json(value: unknown): string {
  return value === null || value === undefined ? '' : JSON.stringify(value)
}

// Имя листа: без запрещённых символов, до 31 знака, без повторов (Excel не различает регистр)
export function sheetNameFor(name: string, used: Set<string>): string {
  const base = name.replace(FORBIDDEN_SHEET_CHARS, ' ').trim().slice(0, SHEET_NAME_LIMIT) || 'Расписание'
  let candidate = base
  for (let n = 2; used.has(candidate.toLowerCase()); n++) {
    const suffix = ` ${n}`
    candidate = `${base.slice(0, SHEET_NAME_LIMIT - suffix.length)}${suffix}`
  }
  used.add(candidate.toLowerCase())
  return candidate
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true }
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
}

function writeCalendarSheet(
  ws: ExcelJS.Worksheet,
  calendar: ExportCalendar,
  events: EventRecord[],
  types: EventType[],
) {
  ws.getColumn(1).width = MONTH_COLUMN_WIDTH
  for (let d = 0; d < DAY_COLUMNS; d++) {
    ws.getColumn(FIRST_DAY_COLUMN + d).width = DAY_COLUMN_WIDTH
  }
  // Масштаб и закреплённые строка с числами и столбец месяцев: всё видно сразу
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1, zoomScale: ZOOM }]

  const numbers = ws.getRow(1)
  for (let d = 1; d <= DAY_COLUMNS; d++) numbers.getCell(FIRST_DAY_COLUMN + d - 1).value = d
  styleHeader(numbers)

  let r = 2
  for (const month of calendar.months) {
    const weekRow = ws.getRow(r)
    month.weekdays.forEach((weekday, i) => {
      const cell = weekRow.getCell(FIRST_DAY_COLUMN + i)
      const color = month.weekdayColors[i]
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.font = { bold: true, size: FONT_SIZE }
      if (weekday !== null && color) {
        cell.value = ru.weekdaysShort[weekday]
        cell.fill = fill(color)
        cell.font = { bold: true, size: FONT_SIZE, color: { argb: argb(contrastText(color)) } }
      } else {
        cell.fill = fill(GREY)
      }
    })
    weekRow.height = LINE_HEIGHT + 2
    r++

    const firstRow = r
    for (const row of month.rows) {
      const xrow = ws.getRow(r)
      let lines = 1
      month.days.forEach((day, i) => {
        if (day === null) xrow.getCell(FIRST_DAY_COLUMN + i).fill = fill(GREY)
      })
      row.cells.forEach((cell, i) => {
        if (cell === null) return
        const target = xrow.getCell(FIRST_DAY_COLUMN + i)
        target.value = cell.text
        target.alignment = { vertical: 'top', wrapText: true }
        target.font = { size: FONT_SIZE }
        if (cell.color) {
          target.fill = fill(cell.color)
          target.font = { size: FONT_SIZE, color: { argb: argb(contrastText(cell.color)) } }
        }
        if (cell.span > 1) {
          ws.mergeCells(r, FIRST_DAY_COLUMN + i, r, FIRST_DAY_COLUMN + i + cell.span - 1)
        }
        lines = Math.max(lines, Math.ceil(cell.text.length / (CHARS_PER_LINE * cell.span)))
      })
      xrow.height = LINE_HEIGHT * lines + 2
      r++
    }
    // Цвет месяца тянется на все строки месяца, кроме строки с днями недели
    const label = ws.getCell(firstRow, 1)
    label.value = `${ru.months[month.month - 1]} ${month.year}`
    label.fill = fill(month.monthColor)
    label.font = { bold: true, size: FONT_SIZE, color: { argb: argb(contrastText(month.monthColor)) } }
    label.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    if (r - 1 > firstRow) ws.mergeCells(firstRow, 1, r - 1, 1)
    r++
  }
  writeDeadlineList(ws, r, buildDeadlineList(events, types))
}

// Список дедлайнов под таблицей: название в столбцах A–D, дата в E, выполнено в F
function writeDeadlineList(ws: ExcelJS.Worksheet, start: number, items: DeadlineListItem[]) {
  const titleRow = ws.getRow(start)
  titleRow.getCell(1).value = ru.excel.deadlinesTitle
  titleRow.font = { bold: true }

  const headerRow = ws.getRow(start + 1)
  headerRow.getCell(1).value = ru.excel.deadlinesHeaders[0]
  headerRow.getCell(5).value = ru.excel.deadlinesHeaders[1]
  headerRow.getCell(6).value = ru.excel.deadlinesHeaders[2]
  styleHeader(headerRow)
  ws.mergeCells(start + 1, 1, start + 1, 4)

  items.forEach((item, i) => {
    const row = ws.getRow(start + 2 + i)
    row.getCell(1).value = item.title
    row.getCell(5).value = formatDateRu(item.date)
    row.getCell(6).value = item.done ? ru.excel.doneYes : ru.excel.doneNo
    ws.mergeCells(start + 2 + i, 1, start + 2 + i, 4)
  })
}

function writeDataSheets(workbook: ExcelJS.Workbook, data: ExportData, semesters: Semester[]) {
  const { sheets, headers } = ru.excel
  const ids = new Set(semesters.map((s) => s.id))
  const addSheet = (name: string, columns: readonly string[], rows: (string | number)[][]) => {
    const ws = workbook.addWorksheet(name)
    styleHeader(ws.addRow(columns))
    rows.forEach((row) => ws.addRow(row))
    ws.columns.forEach((col) => (col.width = 22))
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    return ws
  }

  addSheet(
    sheets.events,
    headers.events,
    data.events
      .filter((e) => ids.has(e.semesterId))
      .map((e) => [
        e.id,
        e.semesterId,
        e.title,
        e.typeId ?? '',
        e.subjectId ?? '',
        e.startDate ?? '',
        e.endDate ?? '',
        e.time ?? '',
        e.importance ?? '',
        e.lane ?? '',
        e.note,
        yesNo(e.done),
        yesNo(e.archived),
        json(e.windows),
        e.createdAt,
        e.updatedAt,
      ]),
  )
  addSheet(
    sheets.types,
    headers.types,
    data.types.map((t) => [
      t.id,
      t.name,
      t.keywords.join(', '),
      t.defaultImportance ?? '',
      t.color ?? '',
      yesNo(t.showAtBottom),
      t.order,
      yesNo(t.builtIn),
    ]),
  )
  addSheet(
    sheets.levels,
    headers.levels,
    data.levels.map((l) => [l.id, l.number, l.name, l.color, l.order]),
  )
  addSheet(
    sheets.subjects,
    headers.subjects,
    data.subjects.map((s) => [s.id, s.name, s.shortName, s.weight, yesNo(s.demo)]),
  )
  addSheet(
    sheets.schedules,
    headers.schedules,
    semesters.map((s) => [
      s.id,
      s.name,
      s.startDate,
      s.endDate,
      s.weekOneMonday ?? '',
      s.monthColumnWidth,
      json(s.columnWidths),
      json(s.hiddenMonths),
      json(s.palette),
      yesNo(s.isDemo),
      yesNo(s.archived),
      s.createdAt,
      s.updatedAt,
    ]),
  )
  addSheet(
    sheets.settings,
    headers.settings,
    Object.entries(data.settings).map(([key, value]) => [key, json(value)]),
  )
  addSheet(sheets.service, headers.service, [
    ['format', EXPORT_FORMAT],
    ['version', EXPORT_FORMAT_VERSION],
    ['exportedAt', data.exportedAt],
    ['schedules', semesters.length],
    ['events', data.events.filter((e) => ids.has(e.semesterId)).length],
  ])
}

// Книга Excel: календарь на каждое выбранное расписание, затем служебные листы (если нужны)
export function buildExportWorkbook(data: ExportData): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date(data.exportedAt)

  const chosen = sortSemesters(data.semesters).filter((s) => data.scheduleIds.includes(s.id))
  const used = new Set(Object.values(ru.excel.sheets).map((name) => name.toLowerCase()))
  for (const semester of chosen) {
    const palette = resolvePalette(semester.palette, data.settings, data.levels)
    const events = data.events.filter((e) => e.semesterId === semester.id)
    const calendar = buildExportCalendar({
      semester,
      events,
      types: data.types,
      levels: paintLevels(data.levels, palette.levelColors),
      weekGradient: palette.weekGradient,
      monthColors: palette.monthColors,
    })
    const ws = workbook.addWorksheet(sheetNameFor(semester.name, used))
    writeCalendarSheet(ws, calendar, events, data.types)
  }

  if (data.includeService) writeDataSheets(workbook, data, chosen)
  return workbook
}
