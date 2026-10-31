// Правила для типов и уровней важности: что можно удалить, какие названия и слова допустимы.
// Стандартные типы и уровни 1–3 нельзя удалить, только переименовать. Удалять можно только то,
// что создал пользователь, и только если им ничего не пользуется (данные не теряются).

import type { EventType, ImportanceLevel } from './catalog'
import type { EventRecord } from './events'

// Уровни 1–3 создаются по умолчанию; 4 и выше создаёт пользователь при вводе (buildLevelsUpTo)
const STANDARD_LEVEL_MAX = 3

export function isBuiltInType(type: EventType): boolean {
  return type.builtIn
}

export function isBuiltInLevel(level: Pick<ImportanceLevel, 'number'>): boolean {
  return level.number <= STANDARD_LEVEL_MAX
}

export type DeleteBlock = { ok: true } | { ok: false; reason: 'built-in' | 'in-use' }

export function canDeleteType(type: EventType, events: EventRecord[]): DeleteBlock {
  if (isBuiltInType(type)) return { ok: false, reason: 'built-in' }
  if (events.some((e) => e.typeId === type.id)) return { ok: false, reason: 'in-use' }
  return { ok: true }
}

// Уровень занят, если событие с ним стоит вручную или его тип задаёт этот уровень по умолчанию
export function canDeleteLevel(
  level: ImportanceLevel,
  events: EventRecord[],
  types: EventType[] = [],
): DeleteBlock {
  if (isBuiltInLevel(level)) return { ok: false, reason: 'built-in' }
  const byEvent = events.some((e) => e.importance === level.number)
  const byType = types.some((t) => t.defaultImportance === level.number)
  if (byEvent || byType) return { ok: false, reason: 'in-use' }
  return { ok: true }
}

export type NameError = 'empty' | 'duplicate'

export function validateTypeName(
  name: string,
  types: EventType[],
  editingId?: string,
): NameError | null {
  const trimmed = name.trim()
  if (trimmed === '') return 'empty'
  const taken = types.some(
    (t) => t.id !== editingId && t.name.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  return taken ? 'duplicate' : null
}

export function validateLevelName(name: string): NameError | null {
  return name.trim() === '' ? 'empty' : null
}

// Ключевые слова вводятся через запятую; слова строчные, без пустых и повторов
export function parseKeywords(input: string): string[] {
  const words = input
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w !== '')
  return [...new Set(words)]
}

export type KeywordError = 'empty' | 'spaces' | 'duplicate'

// Слово без пробела (иначе строка ввода его не распознает) и не занято другим типом
export function validateKeywords(
  keywords: string[],
  types: EventType[],
  editingId?: string,
): KeywordError | null {
  if (keywords.length === 0) return 'empty'
  if (keywords.some((k) => /\s/.test(k))) return 'spaces'
  const others = new Set(
    types.filter((t) => t.id !== editingId).flatMap((t) => t.keywords.map((k) => k.toLowerCase())),
  )
  return keywords.some((k) => others.has(k)) ? 'duplicate' : null
}
