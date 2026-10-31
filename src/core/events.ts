// События: проверка карточки, важность и цвет, порядок, чтение из хранилища

import type { EventType, ImportanceLevel, Subject } from './catalog'
import { compareIsoDates, isValidIsoDate, type IsoDate } from './dates'
import { DEFAULT_DIRECTION, importanceKey, type ImportanceDirection } from './importance'

// Окно сдачи практики: одна из дат, когда её можно сдать
export interface EventWindow {
  startDate: IsoDate
  endDate: IsoDate
  planned: boolean
}

// Название EventRecord, чтобы не путать с браузерным Event
export interface EventRecord {
  id: string
  semesterId: string
  title: string
  typeId: string | null
  subjectId: string | null
  // Без даты: оба null (раздел «Когда-нибудь»). Для одного дня конец равен началу.
  startDate: IsoDate | null
  endDate: IsoDate | null
  time: string | null
  // Ручная важность; null — берётся важность типа
  importance: number | null
  // Строка (дорожка) в месяце; назначается раскладкой на шаге 5
  lane: number | null
  note: string
  done: boolean
  archived: boolean
  // Окна сдачи, если у практики их несколько; иначе пусто
  windows: EventWindow[]
  createdAt: string
  updatedAt: string
}

// Поля карточки как их вводит пользователь (даты и время строками)
export interface EventDraft {
  title: string
  typeId: string | null
  subjectId: string | null
  startDate: string
  endDate: string
  time: string
  importance: number | null
  note: string
  done: boolean
}

export type EventFields = Pick<
  EventRecord,
  'title' | 'typeId' | 'subjectId' | 'startDate' | 'endDate' | 'time' | 'importance' | 'note' | 'done'
>

export type EventError = 'no-title' | 'invalid-date' | 'end-before-start' | 'invalid-time'

export type DraftResult = { ok: true; fields: EventFields } | { ok: false; error: EventError }

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value)
}

// Пустое название строится из предмета и типа: «Матан КР»
export function buildEventTitle(
  title: string,
  subject: Subject | null,
  type: EventType | null,
): string {
  const own = title.trim()
  if (own !== '') return own
  return [subject?.name, type?.name].filter((part): part is string => !!part).join(' ')
}

export function validateEventDraft(
  draft: EventDraft,
  subject: Subject | null,
  type: EventType | null,
): DraftResult {
  const title = buildEventTitle(draft.title, subject, type)
  if (title === '') return { ok: false, error: 'no-title' }

  const start = draft.startDate.trim()
  const end = draft.endDate.trim()
  if ((start !== '' && !isValidIsoDate(start)) || (end !== '' && !isValidIsoDate(end))) {
    return { ok: false, error: 'invalid-date' }
  }
  if (start !== '' && end !== '' && compareIsoDates(end, start) < 0) {
    return { ok: false, error: 'end-before-start' }
  }

  const time = draft.time.trim()
  if (time !== '' && !isValidTime(time)) return { ok: false, error: 'invalid-time' }

  // Дедлайн привязан ко дню конца: если указана только одна дата, она и начало, и конец
  const first = start || end
  const last = end || start
  return {
    ok: true,
    fields: {
      title,
      typeId: draft.typeId,
      subjectId: draft.subjectId,
      startDate: first === '' ? null : first,
      endDate: last === '' ? null : last,
      time: time === '' ? null : time,
      importance: draft.importance,
      note: draft.note,
      done: draft.done,
    },
  }
}

export function createEvent(
  fields: EventFields,
  ids: { id: string; semesterId: string },
  now: string,
  windows: EventWindow[] = [],
): EventRecord {
  return {
    ...fields,
    id: ids.id,
    semesterId: ids.semesterId,
    lane: null,
    archived: false,
    windows,
    createdAt: now,
    updatedAt: now,
  }
}

// Важность = ручное значение, иначе важность типа, иначе нет (BR-1, BR-2)
export function effectiveImportance(event: EventRecord, type: EventType | null): number | null {
  return event.importance ?? type?.defaultImportance ?? null
}

// Цвет блока означает важность; без важности у хакатона цвет его типа; иначе бесцветный (BR-3)
export function eventColor(
  event: EventRecord,
  type: EventType | null,
  levels: ImportanceLevel[],
): string | null {
  const importance = effectiveImportance(event, type)
  if (importance !== null) return levels.find((l) => l.number === importance)?.color ?? null
  return type?.color ?? null
}

// Порядок: раньше дата конца, при равенстве важнее (1 выше 2, без важности ниже), затем раньше созданное.
// При полном равенстве 0: сортировка JS стабильна, значит остаётся порядок в списке (порядок ввода).
export function compareEventsOrder(
  a: EventRecord,
  b: EventRecord,
  types: EventType[],
  direction: ImportanceDirection = DEFAULT_DIRECTION,
): number {
  const typeOf = (e: EventRecord) => types.find((t) => t.id === e.typeId) ?? null
  if (a.endDate !== b.endDate) {
    if (a.endDate === null) return 1
    if (b.endDate === null) return -1
    return compareIsoDates(a.endDate, b.endDate)
  }
  const ia = importanceKey(effectiveImportance(a, typeOf(a)), direction)
  const ib = importanceKey(effectiveImportance(b, typeOf(b)), direction)
  if (ia !== ib) return ia < ib ? -1 : 1
  return a.createdAt.localeCompare(b.createdAt)
}

// То же, но полное равенство разрешается по id, чтобы порядок не зависел от входа (списки)
export function compareEvents(
  a: EventRecord,
  b: EventRecord,
  types: EventType[],
  direction: ImportanceDirection = DEFAULT_DIRECTION,
): number {
  return compareEventsOrder(a, b, types, direction) || a.id.localeCompare(b.id)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseWindows(value: unknown): EventWindow[] {
  if (!Array.isArray(value)) return []
  const windows: EventWindow[] = []
  for (const raw of value) {
    if (!isRecord(raw)) continue
    const start = validDate(raw.startDate)
    const end = validDate(raw.endDate)
    if (start === null || end === null || compareIsoDates(end, start) < 0) continue
    windows.push({ startDate: start, endDate: end, planned: raw.planned === true })
  }
  return windows
}

function validDate(value: unknown): IsoDate | null {
  return typeof value === 'string' && isValidIsoDate(value) ? value : null
}

// Читает запись из хранилища. Событие не теряется из-за испорченных полей: они заменяются
// значениями по умолчанию. Не читается только запись без id, расписания или названия.
export function parseEvent(raw: unknown, fallbackNow: string): EventRecord | null {
  if (!isRecord(raw)) return null
  const { id, semesterId, title } = raw
  if (typeof id !== 'string' || id === '') return null
  if (typeof semesterId !== 'string' || semesterId === '') return null
  if (typeof title !== 'string' || title.trim() === '') return null

  let start = validDate(raw.startDate)
  let end = validDate(raw.endDate)
  if (start === null) start = end
  if (end === null) end = start
  if (start !== null && end !== null && compareIsoDates(end, start) < 0) start = end

  const time = typeof raw.time === 'string' && isValidTime(raw.time) ? raw.time : null
  const importance =
    typeof raw.importance === 'number' && Number.isInteger(raw.importance) && raw.importance >= 1
      ? raw.importance
      : null
  const lane =
    typeof raw.lane === 'number' && Number.isInteger(raw.lane) && raw.lane >= 0 ? raw.lane : null

  return {
    id,
    semesterId,
    title,
    typeId: typeof raw.typeId === 'string' ? raw.typeId : null,
    subjectId: typeof raw.subjectId === 'string' ? raw.subjectId : null,
    startDate: start,
    endDate: end,
    time,
    importance,
    lane,
    note: typeof raw.note === 'string' ? raw.note : '',
    done: raw.done === true,
    archived: raw.archived === true,
    windows: parseWindows(raw.windows),
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : fallbackNow,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : fallbackNow,
  }
}
