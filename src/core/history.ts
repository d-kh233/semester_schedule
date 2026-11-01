// Журнал отмены: что изменилось в событиях при одном действии. Чистая логика, без браузера и хранилища.

import type { EventRecord } from './events'

// Одна запись: событие до и после действия (null — события тогда не было)
export interface EventChange {
  id: string
  before: EventRecord | null
  after: EventRecord | null
}

// Одно действие пользователя: все изменения событий, которые оно сделало
export interface HistoryEntry {
  changes: EventChange[]
}

export type HistorySide = 'before' | 'after'

// Сколько действий помним; старые просто уходят из журнала
export const HISTORY_LIMIT = 100

function sameRecord(a: EventRecord, b: EventRecord): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// Сравнивает два состояния списка событий по id и возвращает только то, что поменялось
export function diffEvents(before: EventRecord[], after: EventRecord[]): EventChange[] {
  const beforeById = new Map(before.map((e) => [e.id, e]))
  const afterById = new Map(after.map((e) => [e.id, e]))
  const ids = new Set([...beforeById.keys(), ...afterById.keys()])
  const changes: EventChange[] = []
  for (const id of ids) {
    const old = beforeById.get(id) ?? null
    const next = afterById.get(id) ?? null
    if (old !== null && next !== null && sameRecord(old, next)) continue
    if (old === null && next === null) continue
    changes.push({ id, before: old, after: next })
  }
  return changes
}

// Ставит события в состояние «до» или «после» действия. Остальные события не трогает.
export function applyChanges(
  events: EventRecord[],
  changes: EventChange[],
  side: HistorySide,
): EventRecord[] {
  const target = new Map(changes.map((c) => [c.id, side === 'before' ? c.before : c.after]))
  const result: EventRecord[] = []
  const seen = new Set<string>()
  for (const event of events) {
    seen.add(event.id)
    if (!target.has(event.id)) {
      result.push(event)
      continue
    }
    const value = target.get(event.id)
    if (value) result.push(value)
  }
  for (const [id, value] of target) {
    if (value && !seen.has(id)) result.push(value)
  }
  return result
}

// Новый стек отмены: действие сверху, старые записи обрезаются
export function pushHistory(stack: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [...stack, entry].slice(-HISTORY_LIMIT)
}
