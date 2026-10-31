// Блоки событий в сетке: что нарисовать в каждом месяце. Чистая логика, без интерфейса.

import type { CalendarMonth } from './calendar'
import type { EventType, ImportanceLevel } from './catalog'
import { isCrowdedDate } from './crowded'
import { compareIsoDates, type IsoDate } from './dates'
import { eventColor, type EventRecord } from './events'
import { eventSpans, isBackgroundEvent, type DateSpan } from './layout'

export interface GridBlock {
  // Уникален в пределах месяца
  key: string
  eventId: string
  // Номер окна практики; null — обычное событие
  windowIndex: number | null
  startDay: number
  endDay: number
  // Строка внутри месяца, с нуля
  row: number
  label: string
  // Цвет по важности или по типу; null — бесцветная ячейка (BR-3)
  color: string | null
  background: boolean
  done: boolean
  past: boolean
  // Планируемое окно практики с акцентом (только если окон несколько)
  planned: boolean
  crowded: boolean
  // Блок продолжается в соседнем месяце
  continuesLeft: boolean
  continuesRight: boolean
}

export interface MonthLayout {
  key: string
  // Число строк месяца: дорожки дедлайнов плюс дорожки фоновых, не меньше одной
  rows: number
  blocks: GridBlock[]
}

export interface BlockInput {
  months: CalendarMonth[]
  // События с уже назначенными дорожками (см. placeLanes)
  events: EventRecord[]
  types: EventType[]
  levels: ImportanceLevel[]
  today: IsoDate
  crowdedDays: number
}

interface Piece extends Omit<GridBlock, 'row'> {
  lane: number
}

// Кусок периода внутри одного месяца и только в днях семестра; null, если пересечения нет
function clipToMonth(month: CalendarMonth, span: DateSpan) {
  const days = month.days.filter(
    (day) =>
      day.date !== null &&
      day.status === 'normal' &&
      compareIsoDates(day.date, span.start) >= 0 &&
      compareIsoDates(day.date, span.end) <= 0,
  )
  const first = days[0]
  const last = days.at(-1)
  if (!first?.date || !last?.date) return null
  return { first, last }
}

function piecesOf(
  event: EventRecord,
  month: CalendarMonth,
  input: BlockInput,
  type: EventType | null,
  background: boolean,
): Piece[] {
  const spans = eventSpans(event)
  const manyWindows = event.windows.length > 1
  const color = eventColor(event, type, input.levels)
  const pieces: Piece[] = []
  spans.forEach((span, index) => {
    const clip = clipToMonth(month, span)
    if (!clip?.first.date || !clip.last.date) return
    const windowIndex = event.windows.length > 0 ? index : null
    const window = windowIndex === null ? null : event.windows[windowIndex]
    pieces.push({
      key: `${event.id}:${windowIndex ?? 'main'}`,
      eventId: event.id,
      windowIndex,
      startDay: clip.first.day,
      endDay: clip.last.day,
      lane: event.lane ?? 0,
      label: event.title,
      color,
      background,
      done: event.done,
      past: compareIsoDates(span.end, input.today) < 0,
      planned: manyWindows && window?.planned === true,
      crowded:
        manyWindows &&
        (isCrowdedDate(span.start, input.crowdedDays) || isCrowdedDate(span.end, input.crowdedDays)),
      continuesLeft: compareIsoDates(clip.first.date, span.start) > 0,
      continuesRight: compareIsoDates(clip.last.date, span.end) < 0,
    })
  })
  return pieces
}

function laneCount(pieces: Piece[]): number {
  return pieces.reduce((max, p) => Math.max(max, p.lane + 1), 0)
}

// Блоки и число строк для каждого месяца календаря
export function buildMonthLayouts(input: BlockInput): MonthLayout[] {
  const shown = input.events.filter((e) => !e.archived && eventSpans(e).length > 0)

  return input.months.map((month) => {
    const pieces: Piece[] = []
    for (const event of shown) {
      const type = input.types.find((t) => t.id === event.typeId) ?? null
      pieces.push(...piecesOf(event, month, input, type, isBackgroundEvent(event, input.types)))
    }
    // Фоновые строки идут после последней дорожки дедлайнов этого месяца (BR-7)
    const deadlineRows = laneCount(pieces.filter((p) => !p.background))
    const backgroundRows = laneCount(pieces.filter((p) => p.background))
    const blocks = pieces.map(({ lane, ...block }): GridBlock => ({
      ...block,
      row: block.background ? deadlineRows + lane : lane,
    }))
    return { key: month.key, rows: Math.max(1, deadlineRows + backgroundRows), blocks }
  })
}
