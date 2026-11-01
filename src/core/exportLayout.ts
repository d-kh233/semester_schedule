// Раскладка календаря для выгрузки в Excel: месяцы, дни, строки под днями и список дедлайнов.
// Чистая логика, без Excel и без текстов интерфейса (подписи месяцев добавляет слой записи).

import { buildCalendar, type CalendarMonth } from './calendar'
import type { EventType, ImportanceLevel } from './catalog'
import { compareIsoDates, type IsoDate } from './dates'
import { compareEvents, eventColor, type EventRecord } from './events'
import { isBackgroundEvent } from './layout'
import type { Semester } from './model'

// Клетка на пересечении строки и числа; span — сколько дней она занимает (фоновый блок)
export interface ExportCell {
  text: string
  color: string | null
  span: number
}

export interface ExportRow {
  kind: 'deadline' | 'background'
  // 31 клетка, индекс = число − 1; null — пусто
  cells: (ExportCell | null)[]
}

export interface ExportMonth {
  key: string
  year: number
  month: number
  // Число дня или null, если такого числа в месяце нет
  days: (number | null)[]
  // 0 = понедельник; null, если такого числа нет
  weekdays: (number | null)[]
  // Сначала строки дедлайнов, потом фоновые; не меньше одной
  rows: ExportRow[]
}

export interface ExportInput {
  semester: Semester
  events: EventRecord[]
  types: EventType[]
  // Уровни с цветами расписания (после раскраски палитрой)
  levels: ImportanceLevel[]
}

export interface ExportCalendar {
  months: ExportMonth[]
}

export interface DeadlineListItem {
  title: string
  date: IsoDate
  done: boolean
}

const DAYS = 31

function emptyCells(): (ExportCell | null)[] {
  return Array<ExportCell | null>(DAYS).fill(null)
}

function typeOf(event: EventRecord, types: EventType[]): EventType | null {
  return types.find((t) => t.id === event.typeId) ?? null
}

// Первый и последний индекс дня месяца, который попадает в период события и в семестр
function barRange(month: CalendarMonth, event: EventRecord): { first: number; last: number } | null {
  if (event.startDate === null || event.endDate === null) return null
  let first = -1
  let last = -1
  month.days.forEach((day, index) => {
    if (day.status !== 'normal' || day.date === null) return
    const inside =
      compareIsoDates(day.date, event.startDate!) >= 0 && compareIsoDates(day.date, event.endDate!) <= 0
    if (!inside) return
    if (first < 0) first = index
    last = index
  })
  return first < 0 ? null : { first, last }
}

function deadlineCell(event: EventRecord, types: EventType[], levels: ImportanceLevel[]): ExportCell {
  return {
    text: event.title,
    color: eventColor(event, typeOf(event, types), levels),
    span: 1,
  }
}

// Фоновые события кладём в строки жадно: в первую строку, где место свободно
function placeBackground(
  month: CalendarMonth,
  events: EventRecord[],
  types: EventType[],
  levels: ImportanceLevel[],
): (ExportCell | null)[][] {
  const bars = events
    .map((event) => ({ event, range: barRange(month, event) }))
    .filter((bar): bar is { event: EventRecord; range: { first: number; last: number } } => bar.range !== null)
    .sort((a, b) => a.range.first - b.range.first)

  const rows: (ExportCell | null)[][] = []
  const rowEnds: number[] = []
  for (const { event, range } of bars) {
    let row = rowEnds.findIndex((end) => end < range.first)
    if (row < 0) {
      row = rows.length
      rows.push(emptyCells())
      rowEnds.push(-1)
    }
    rowEnds[row] = range.last
    const cells = rows[row] ?? emptyCells()
    cells[range.first] = {
      ...deadlineCell(event, types, levels),
      span: range.last - range.first + 1,
    }
  }
  return rows
}

function buildMonth(
  month: CalendarMonth,
  events: EventRecord[],
  types: EventType[],
  levels: ImportanceLevel[],
): ExportMonth {
  // Дедлайн ставится на день конца события (как в сетке, BR-4)
  const perDay: EventRecord[][] = month.days.map(() => [])
  const background: EventRecord[] = []
  for (const event of events) {
    if (isBackgroundEvent(event, types)) {
      background.push(event)
      continue
    }
    if (event.endDate === null) continue
    const index = month.days.findIndex((d) => d.status === 'normal' && d.date === event.endDate)
    perDay[index]?.push(event)
  }
  perDay.forEach((list) => list.sort((a, b) => compareEvents(a, b, types)))

  const deadlineCount = perDay.reduce((max, list) => Math.max(max, list.length), 0)
  const deadlineRows: ExportRow[] = Array.from({ length: deadlineCount }, (_, row) => ({
    kind: 'deadline',
    cells: perDay.map((list) => (list[row] ? deadlineCell(list[row], types, levels) : null)),
  }))
  const backgroundRows: ExportRow[] = placeBackground(month, background, types, levels).map((cells) => ({
    kind: 'background',
    cells,
  }))

  const rows = [...deadlineRows, ...backgroundRows]
  return {
    key: month.key,
    year: month.year,
    month: month.month,
    days: month.days.map((d) => (d.status === 'nonexistent' ? null : d.day)),
    weekdays: month.days.map((d) => d.weekday),
    rows: rows.length > 0 ? rows : [{ kind: 'deadline', cells: emptyCells() }],
  }
}

// Календарь семестра. Архивные события и события без даты в календарь не попадают.
export function buildExportCalendar(input: ExportInput): ExportCalendar {
  const { semester, types, levels } = input
  const shown = input.events.filter((e) => !e.archived)
  const months = buildCalendar(semester.startDate, semester.endDate)
  return { months: months.map((month) => buildMonth(month, shown, types, levels)) }
}

// Список дедлайнов под таблицей: все не архивные события с датой, по дате конца
export function buildDeadlineList(events: EventRecord[], types: EventType[]): DeadlineListItem[] {
  return events
    .filter((e) => !e.archived && e.endDate !== null)
    .sort((a, b) => compareIsoDates(a.endDate!, b.endDate!) || compareEvents(a, b, types))
    .map((e) => ({ title: e.title, date: e.endDate!, done: e.done }))
}
