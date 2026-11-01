// Список дедлайнов: порядок, раздел «Когда-нибудь», текст списка по предмету. Чистая логика.

import { type EventType, type Subject } from './catalog'
import { compareIsoDates, parseIsoDate } from './dates'
import { DEFAULT_DIRECTION, importanceKey, type ImportanceDirection } from './importance'
import { compareEvents, effectiveImportance, type EventRecord } from './events'

// Порядок списка (BR-15, FR-19): выполненные вниз; раньше дата конца; при равенстве выше важность;
// затем выше вес предмета; затем порядок создания. Архивные и без даты сюда не попадают.
export function sortDeadlines(
  events: EventRecord[],
  types: EventType[],
  subjects: Subject[],
  direction: ImportanceDirection = DEFAULT_DIRECTION,
): EventRecord[] {
  const typeOf = (e: EventRecord) => types.find((t) => t.id === e.typeId) ?? null
  const weightOf = (e: EventRecord) => subjects.find((s) => s.id === e.subjectId)?.weight ?? 0

  return events
    .filter((e) => !e.archived && e.endDate !== null)
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1
      if (a.endDate !== b.endDate) return compareIsoDates(a.endDate ?? '', b.endDate ?? '')
      const ia = importanceKey(effectiveImportance(a, typeOf(a)), direction)
      const ib = importanceKey(effectiveImportance(b, typeOf(b)), direction)
      if (ia !== ib) return ia < ib ? -1 : 1
      if (weightOf(a) !== weightOf(b)) return weightOf(b) - weightOf(a)
      return compareEvents(a, b, types, direction)
    })
}

// Раздел «Когда-нибудь»: живые события без даты (BR-10)
export function undatedEvents(events: EventRecord[]): EventRecord[] {
  return events.filter((e) => !e.archived && e.endDate === null)
}

// Дата для списка копирования: ДД.ММ, без года (как в примере раздела 11)
export function dayMonthText(date: string): string {
  const { month, day } = parseIsoDate(date)
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}`
}

// Название в списке копирования: тип, если он есть, иначе название события
function listLabel(event: EventRecord, types: EventType[]): string {
  const type = types.find((t) => t.id === event.typeId)
  return type ? type.name : event.title
}

// Список дедлайнов предмета для копирования текстом (раздел 11 ТЗ):
// заголовок «Предмет:», затем нумерованные строки по возрастанию дат.
// until — дата, до которой включать (включительно); null — все дедлайны.
export function subjectListText(
  subject: Subject,
  events: EventRecord[],
  types: EventType[],
  until: string | null,
): string {
  const own = events.filter(
    (e) =>
      e.subjectId === subject.id &&
      !e.archived &&
      e.endDate !== null &&
      (until === null || compareIsoDates(e.endDate, until) <= 0),
  )
  const sorted = [...own].sort((a, b) => {
    if (a.endDate !== b.endDate) return compareIsoDates(a.endDate ?? '', b.endDate ?? '')
    return compareEvents(a, b, types)
  })
  const lines = sorted.map((e, index) => {
    const time = e.time ? ` ${e.time}` : ''
    return `${index + 1}. ${listLabel(e, types)} ${dayMonthText(e.endDate ?? '')}${time}`
  })
  return [`${subject.name}:`, ...lines].join('\n')
}

// Экспорт всех дедлайнов с датами: нумерованный список по возрастанию дат, с предметом.
// until — дата, до которой включать (включительно); null — все. Пустой список даёт пустую строку.
export function deadlineListText(
  events: EventRecord[],
  types: EventType[],
  subjects: Subject[],
  until: string | null,
): string {
  const dated = events.filter(
    (e) =>
      !e.archived &&
      e.endDate !== null &&
      (until === null || compareIsoDates(e.endDate, until) <= 0),
  )
  const sorted = [...dated].sort((a, b) => {
    if (a.endDate !== b.endDate) return compareIsoDates(a.endDate ?? '', b.endDate ?? '')
    return compareEvents(a, b, types)
  })
  return sorted
    .map((e, index) => {
      const subject = subjects.find((s) => s.id === e.subjectId)
      const head = subject ? `${subject.name} · ` : ''
      const time = e.time ? ` ${e.time}` : ''
      return `${index + 1}. ${dayMonthText(e.endDate ?? '')} ${head}${listLabel(e, types)}${time}`
    })
    .join('\n')
}
