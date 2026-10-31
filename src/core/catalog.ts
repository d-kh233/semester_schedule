// Справочники: уровни важности, типы событий, предметы

import { isHexColor } from './colors'

export interface ImportanceLevel {
  id: string
  number: number
  name: string
  color: string
  order: number
}

export interface EventType {
  id: string
  name: string
  // Слова, по которым тип узнаётся в строке ввода (строчными буквами)
  keywords: string[]
  // Важность по умолчанию; null — у типа важности нет
  defaultImportance: number | null
  // Свой цвет, только для типов вне шкалы важности (хакатон)
  color: string | null
  // Идёт внизу месяца цельной линией после дедлайнов
  showAtBottom: boolean
  // Порядок в списках выбора
  order: number
}

export interface Subject {
  id: string
  name: string
  shortName: string
  weight: number
  // Предмет создан для демо-расписания и в личном не показывается
  demo: boolean
}

const FALLBACK_COLOR = '#cccccc'

export function buildDefaultCatalog(newId: () => string): {
  types: EventType[]
  levels: ImportanceLevel[]
} {
  const levels: ImportanceLevel[] = [
    { id: newId(), number: 1, name: 'Важность 1', color: '#c0502d', order: 1 },
    { id: newId(), number: 2, name: 'Важность 2', color: '#f6d98f', order: 2 },
    { id: newId(), number: 3, name: 'Важность 3', color: '#f5dcc4', order: 3 },
  ]
  const types: EventType[] = [
    {
      id: newId(),
      name: 'КР',
      keywords: ['кр'],
      defaultImportance: 1,
      color: null,
      showAtBottom: false,
      order: 1,
    },
    {
      id: newId(),
      name: 'Практика',
      keywords: ['практика'],
      defaultImportance: 2,
      color: null,
      showAtBottom: false,
      order: 2,
    },
    {
      id: newId(),
      name: 'Тест',
      keywords: ['тест'],
      defaultImportance: 3,
      color: null,
      showAtBottom: false,
      order: 3,
    },
    {
      id: newId(),
      name: 'Хакатон',
      keywords: ['хакатон'],
      defaultImportance: null,
      color: '#f0a03c',
      showAtBottom: true,
      order: 4,
    },
    {
      id: newId(),
      name: 'Подготовка к экзаменам',
      keywords: ['подготовка'],
      defaultImportance: null,
      color: '#d9c2a0',
      showAtBottom: true,
      order: 5,
    },
  ]
  return { types, levels }
}

export type SubjectError = 'name-empty' | 'short-empty' | 'short-spaces' | 'short-duplicate'

export function validateSubject(
  input: { name: string; shortName: string },
  existing: Subject[],
  editingId?: string,
): SubjectError | null {
  const short = input.shortName.trim()
  if (input.name.trim() === '') return 'name-empty'
  if (short === '') return 'short-empty'
  // Короткое имя вводится одним словом, иначе строка ввода его не распознает
  if (/\s/.test(short)) return 'short-spaces'
  const taken = existing.some(
    (s) => s.id !== editingId && s.shortName.trim().toLowerCase() === short.toLowerCase(),
  )
  return taken ? 'short-duplicate' : null
}

export function createSubject(
  input: { name: string; shortName: string },
  id: string,
  demo: boolean,
): Subject {
  return { id, name: input.name.trim(), shortName: input.shortName.trim(), weight: 1, demo }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

export function parseImportanceLevel(raw: unknown): ImportanceLevel | null {
  if (!isRecord(raw) || !nonEmptyString(raw.id) || !positiveInteger(raw.number)) return null
  return {
    id: raw.id,
    number: raw.number,
    name: nonEmptyString(raw.name) ? raw.name : `Важность ${raw.number}`,
    color: typeof raw.color === 'string' && isHexColor(raw.color) ? raw.color : FALLBACK_COLOR,
    order: positiveInteger(raw.order) ? raw.order : raw.number,
  }
}

export function parseEventType(raw: unknown): EventType | null {
  if (!isRecord(raw) || !nonEmptyString(raw.id) || !nonEmptyString(raw.name)) return null
  return {
    id: raw.id,
    name: raw.name,
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords.filter((k): k is string => typeof k === 'string')
      : [],
    defaultImportance: positiveInteger(raw.defaultImportance) ? raw.defaultImportance : null,
    color: typeof raw.color === 'string' && isHexColor(raw.color) ? raw.color : null,
    showAtBottom: raw.showAtBottom === true,
    order: positiveInteger(raw.order) ? raw.order : 999,
  }
}

// Хранилище отдаёт записи в порядке идентификаторов, то есть случайном, поэтому порядок задаём сами
export function sortTypes(types: EventType[]): EventType[] {
  return [...types].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id),
  )
}

export function sortLevels(levels: ImportanceLevel[]): ImportanceLevel[] {
  return [...levels].sort((a, b) => a.order - b.order || a.number - b.number)
}

export function sortSubjects(subjects: Subject[]): Subject[] {
  return [...subjects].sort(
    (a, b) => a.name.localeCompare(b.name, 'ru') || a.id.localeCompare(b.id),
  )
}

export function parseSubject(raw: unknown): Subject | null {
  if (!isRecord(raw) || !nonEmptyString(raw.id)) return null
  if (!nonEmptyString(raw.name) || !nonEmptyString(raw.shortName)) return null
  return {
    id: raw.id,
    name: raw.name,
    shortName: raw.shortName,
    weight:
      typeof raw.weight === 'number' && Number.isFinite(raw.weight) && raw.weight > 0
        ? raw.weight
        : 1,
    demo: raw.demo === true,
  }
}
