// Хранилище в браузере (IndexedDB). Остальной код про IndexedDB ничего не знает.
// Правило безопасности: записи не удаляются автоматически, нечитаемые записи пропускаются,
// но остаются в базе нетронутыми.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { parseSemester, type Semester } from '../core/model'
import { parseSettings, type Settings } from '../core/settings'

interface AppSchema extends DBSchema {
  semesters: { key: string; value: Semester }
  settings: { key: string; value: Settings }
  meta: { key: string; value: string }
}

export type AppDb = IDBPDatabase<AppSchema>

const DB_NAME = 'semester-schedule'
const DB_VERSION = 1
const SETTINGS_KEY = 'main'
const ACTIVE_KEY = 'activeSemesterId'

export interface StoredData {
  semesters: Semester[]
  settings: Settings | null
  activeSemesterId: string | null
  skippedRecords: number
}

export function openAppDb(): Promise<AppDb> {
  return openDB<AppSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('semesters', { keyPath: 'id' })
      db.createObjectStore('settings')
      db.createObjectStore('meta')
    },
  })
}

export async function loadAll(db: AppDb, now: string): Promise<StoredData> {
  const rawSemesters: unknown[] = await db.getAll('semesters')
  const semesters: Semester[] = []
  let skippedRecords = 0
  for (const raw of rawSemesters) {
    const parsed = parseSemester(raw, now)
    if (parsed) semesters.push(parsed)
    else skippedRecords++
  }
  const rawSettings: unknown = await db.get('settings', SETTINGS_KEY)
  const activeSemesterId = (await db.get('meta', ACTIVE_KEY)) ?? null
  return {
    semesters,
    settings: rawSettings === undefined ? null : parseSettings(rawSettings),
    activeSemesterId,
    skippedRecords,
  }
}

export async function putSemester(db: AppDb, semester: Semester): Promise<void> {
  await db.put('semesters', semester)
}

export async function putSettings(db: AppDb, settings: Settings): Promise<void> {
  await db.put('settings', settings, SETTINGS_KEY)
}

export async function putActiveSemesterId(db: AppDb, id: string): Promise<void> {
  await db.put('meta', id, ACTIVE_KEY)
}

// Записывает всё сразу одной транзакцией: либо всё, либо ничего
export async function putInitialData(
  db: AppDb,
  semesters: Semester[],
  settings: Settings,
  activeSemesterId: string,
): Promise<void> {
  const tx = db.transaction(['semesters', 'settings', 'meta'], 'readwrite')
  for (const semester of semesters) void tx.objectStore('semesters').put(semester)
  void tx.objectStore('settings').put(settings, SETTINGS_KEY)
  void tx.objectStore('meta').put(activeSemesterId, ACTIVE_KEY)
  await tx.done
}
