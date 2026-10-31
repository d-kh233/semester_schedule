// Раскладка событий по строкам (дорожкам), раздел 9 ТЗ.
// Дорожка хранится в событии (lane) и сама не меняется: новые события не сдвигают старые (BR-5),
// пересчёт с нуля только по кнопке (mode: 'resort').

import type { EventType } from './catalog'
import { compareIsoDates, type IsoDate } from './dates'
import { compareEventsOrder, type EventRecord } from './events'

export interface DateSpan {
  start: IsoDate
  end: IsoDate
}

export interface PlaceOptions {
  // fill: расставить только тех, у кого дорожки нет или она занята; resort: всё заново
  mode?: 'fill' | 'resort'
  // Раскладывать только события этого расписания; без значения — все
  semesterId?: string
  // События, которые уступают при столкновении сохранённых дорожек (только что изменённые)
  yieldIds?: ReadonlySet<string>
}

export interface PlaceResult {
  events: EventRecord[]
  // Только те события, у которых дорожка изменилась
  changed: EventRecord[]
}

// Фоновое событие: тип с галочкой «показывать внизу» (хакатон и т. п.)
export function isBackgroundEvent(event: EventRecord, types: EventType[]): boolean {
  return types.find((t) => t.id === event.typeId)?.showAtBottom === true
}

// Дни, которые событие занимает в сетке: окна практики, иначе весь период. Без даты — пусто.
export function eventSpans(event: EventRecord): DateSpan[] {
  if (event.startDate === null || event.endDate === null) return []
  if (event.windows.length > 0) {
    return event.windows.map((w) => ({ start: w.startDate, end: w.endDate }))
  }
  return [{ start: event.startDate, end: event.endDate }]
}

function overlaps(a: DateSpan, b: DateSpan): boolean {
  return compareIsoDates(a.start, b.end) <= 0 && compareIsoDates(b.start, a.end) <= 0
}

// Занятые дни по дорожкам одного набора (дедлайны или фоновые)
class Occupancy {
  private readonly byLane = new Map<number, DateSpan[]>()

  isFree(lane: number, spans: DateSpan[]): boolean {
    const taken = this.byLane.get(lane) ?? []
    return !spans.some((span) => taken.some((t) => overlaps(span, t)))
  }

  take(lane: number, spans: DateSpan[]): void {
    this.byLane.set(lane, [...(this.byLane.get(lane) ?? []), ...spans])
  }

  lowestFree(spans: DateSpan[]): number {
    let lane = 0
    while (!this.isFree(lane, spans)) lane++
    return lane
  }
}

function byCreated(a: EventRecord, b: EventRecord): number {
  return a.createdAt.localeCompare(b.createdAt)
}

// Фоновые друг под другом по дате начала (п. 4), затем как остальные
function compareBackground(a: EventRecord, b: EventRecord, types: EventType[]): number {
  if (a.startDate !== b.startDate && a.startDate !== null && b.startDate !== null) {
    return compareIsoDates(a.startDate, b.startDate)
  }
  return compareEventsOrder(a, b, types)
}

function placeSet(
  items: EventRecord[],
  types: EventType[],
  options: PlaceOptions,
  background: boolean,
): Map<string, number> {
  const result = new Map<string, number>()
  const occupancy = new Occupancy()
  const resort = options.mode === 'resort'
  const yielding = options.yieldIds ?? new Set<string>()

  let unplaced: EventRecord[] = items
  if (!resort) {
    // Сначала остаются те, у кого дорожка уже есть: старые раньше новых, уступающие в конце
    const fixed = items
      .filter((e) => e.lane !== null)
      .sort((a, b) => Number(yielding.has(a.id)) - Number(yielding.has(b.id)) || byCreated(a, b))
    const rest = items.filter((e) => e.lane === null)
    for (const event of fixed) {
      const spans = eventSpans(event)
      const lane = event.lane ?? 0
      if (occupancy.isFree(lane, spans)) {
        occupancy.take(lane, spans)
        result.set(event.id, lane)
      } else {
        rest.push(event)
      }
    }
    unplaced = rest
  }

  const compare = background
    ? (a: EventRecord, b: EventRecord) => compareBackground(a, b, types)
    : (a: EventRecord, b: EventRecord) => compareEventsOrder(a, b, types)
  for (const event of [...unplaced].sort(compare)) {
    const spans = eventSpans(event)
    const lane = occupancy.lowestFree(spans)
    occupancy.take(lane, spans)
    result.set(event.id, lane)
  }
  return result
}

// Назначает дорожки. Архивные и безвременные события не раскладываются и остаются как были.
// События разных расписаний раскладываются независимо.
export function placeLanes(
  events: EventRecord[],
  types: EventType[],
  now: string,
  options: PlaceOptions = {},
): PlaceResult {
  const lanes = new Map<string, number>()
  const semesterIds = new Set(events.map((e) => e.semesterId))

  for (const semesterId of semesterIds) {
    if (options.semesterId !== undefined && options.semesterId !== semesterId) continue
    const shown = events.filter(
      (e) => e.semesterId === semesterId && !e.archived && eventSpans(e).length > 0,
    )
    const deadlines = shown.filter((e) => !isBackgroundEvent(e, types))
    const background = shown.filter((e) => isBackgroundEvent(e, types))
    for (const [set, isBackground] of [
      [deadlines, false],
      [background, true],
    ] as const) {
      for (const [id, lane] of placeSet(set, types, options, isBackground)) lanes.set(id, lane)
    }
  }

  const changed: EventRecord[] = []
  const result = events.map((event) => {
    const lane = lanes.get(event.id)
    if (lane === undefined || lane === event.lane) return event
    const updated = { ...event, lane, updatedAt: now }
    changed.push(updated)
    return updated
  })
  return { events: result, changed }
}

// Если событие стало фоновым (или перестало), старая дорожка из другого набора ему не подходит
export function resetLaneIfSpaceChanged(
  before: EventRecord,
  after: EventRecord,
  types: EventType[],
): EventRecord {
  if (isBackgroundEvent(before, types) === isBackgroundEvent(after, types)) return after
  return { ...after, lane: null }
}
