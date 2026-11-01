// Восстановление из выгрузки: слияние по id. Записи из файла добавляются или обновляются,
// записи, которых в файле нет, не удаляются (данные не теряются).

import type { EventType, ImportanceLevel, Subject } from './catalog'
import type { EventRecord } from './events'
import type { Semester } from './model'

export interface BackupData {
  semesters: Semester[]
  events: EventRecord[]
  types: EventType[]
  levels: ImportanceLevel[]
  subjects: Subject[]
}

export interface MergeCounts {
  created: number
  updated: number
}

export interface BackupMerge {
  // Все данные после слияния
  data: BackupData
  // Сколько создано и обновлено по каждому виду записей
  counts: Record<keyof BackupData, MergeCounts>
  // Только записи, которые надо записать в хранилище (созданные и изменённые)
  written: BackupData
}

interface WithId {
  id: string
}

// Сравнение записей без учёта порядка полей (после чтения файла поля идут в другом порядке)
function sameRecord(a: unknown, b: unknown): boolean {
  return stableJson(a) === stableJson(b)
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
    return `{${entries.join(',')}}`
  }
  return JSON.stringify(value)
}

function mergeList<T extends WithId>(current: T[], incoming: T[]): { data: T[]; counts: MergeCounts; written: T[] } {
  const byId = new Map(current.map((item) => [item.id, item]))
  const written: T[] = []
  const counts: MergeCounts = { created: 0, updated: 0 }
  for (const item of incoming) {
    const old = byId.get(item.id)
    if (old === undefined) {
      counts.created++
      written.push(item)
      byId.set(item.id, item)
    } else if (!sameRecord(old, item)) {
      counts.updated++
      written.push(item)
      byId.set(item.id, item)
    }
  }
  // Порядок текущих записей сохраняется, новые добавляются в конец
  const data = [...current.map((item) => byId.get(item.id) ?? item)]
  for (const item of incoming) {
    if (!current.some((c) => c.id === item.id)) data.push(byId.get(item.id) ?? item)
  }
  return { data, counts, written }
}

export function mergeBackup(current: BackupData, incoming: BackupData): BackupMerge {
  const semesters = mergeList(current.semesters, incoming.semesters)
  const events = mergeList(current.events, incoming.events)
  const types = mergeList(current.types, incoming.types)
  const levels = mergeList(current.levels, incoming.levels)
  const subjects = mergeList(current.subjects, incoming.subjects)
  return {
    data: {
      semesters: semesters.data,
      events: events.data,
      types: types.data,
      levels: levels.data,
      subjects: subjects.data,
    },
    counts: {
      semesters: semesters.counts,
      events: events.counts,
      types: types.counts,
      levels: levels.counts,
      subjects: subjects.counts,
    },
    written: {
      semesters: semesters.written,
      events: events.written,
      types: types.written,
      levels: levels.written,
      subjects: subjects.written,
    },
  }
}
