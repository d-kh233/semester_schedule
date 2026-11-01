// Хранилище в браузере (IndexedDB). Остальной код про IndexedDB ничего не знает.
// Правила безопасности: записи не удаляются автоматически (кроме окончательного удаления
// события по подтверждению), нечитаемые записи пропускаются, но остаются в базе нетронутыми.
// Версии базы только добавляют разделы и не меняют существующие данные.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import {
  parseEventType,
  parseImportanceLevel,
  parseSubject,
  type EventType,
  type ImportanceLevel,
  type Subject,
} from '../core/catalog'
import type { BackupData } from '../core/backup'
import { parseEvent, type EventRecord } from '../core/events'
import { parseSemester, type Semester } from '../core/model'
import { parseSettings, type Settings } from '../core/settings'

interface AppSchema extends DBSchema {
  semesters: { key: string; value: Semester }
  settings: { key: string; value: Settings }
  meta: { key: string; value: string }
  events: { key: string; value: EventRecord }
  eventTypes: { key: string; value: EventType }
  importanceLevels: { key: string; value: ImportanceLevel }
  subjects: { key: string; value: Subject }
}

export type AppDb = IDBPDatabase<AppSchema>

const DB_NAME = 'semester-schedule'
const DB_VERSION = 2
const SETTINGS_KEY = 'main'
const ACTIVE_KEY = 'activeSemesterId'
const CATALOG_SEEDED_KEY = 'catalogSeeded'
const DEMO_SEEDED_KEY = 'demoSeeded'

export interface StoredData {
  semesters: Semester[]
  settings: Settings | null
  activeSemesterId: string | null
  events: EventRecord[]
  types: EventType[]
  levels: ImportanceLevel[]
  subjects: Subject[]
  catalogSeeded: boolean
  demoSeeded: boolean
  skippedRecords: number
}

export function openAppDb(): Promise<AppDb> {
  return openDB<AppSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('semesters', { keyPath: 'id' })
        db.createObjectStore('settings')
        db.createObjectStore('meta')
      }
      if (oldVersion < 2) {
        db.createObjectStore('events', { keyPath: 'id' })
        db.createObjectStore('eventTypes', { keyPath: 'id' })
        db.createObjectStore('importanceLevels', { keyPath: 'id' })
        db.createObjectStore('subjects', { keyPath: 'id' })
      }
    },
  })
}

function readAll<T>(raws: unknown[], parse: (raw: unknown) => T | null): { items: T[]; skipped: number } {
  const items: T[] = []
  let skipped = 0
  for (const raw of raws) {
    const parsed = parse(raw)
    if (parsed) items.push(parsed)
    else skipped++
  }
  return { items, skipped }
}

export async function loadAll(db: AppDb, now: string): Promise<StoredData> {
  const semesters = readAll<Semester>(await db.getAll('semesters'), (r) => parseSemester(r, now))
  const events = readAll<EventRecord>(await db.getAll('events'), (r) => parseEvent(r, now))
  const types = readAll<EventType>(await db.getAll('eventTypes'), parseEventType)
  const levels = readAll<ImportanceLevel>(await db.getAll('importanceLevels'), parseImportanceLevel)
  const subjects = readAll<Subject>(await db.getAll('subjects'), parseSubject)
  const rawSettings: unknown = await db.get('settings', SETTINGS_KEY)
  return {
    semesters: semesters.items,
    settings: rawSettings === undefined ? null : parseSettings(rawSettings),
    activeSemesterId: (await db.get('meta', ACTIVE_KEY)) ?? null,
    events: events.items,
    types: types.items,
    levels: levels.items,
    subjects: subjects.items,
    catalogSeeded: (await db.get('meta', CATALOG_SEEDED_KEY)) === '1',
    demoSeeded: (await db.get('meta', DEMO_SEEDED_KEY)) === '1',
    skippedRecords:
      semesters.skipped + events.skipped + types.skipped + levels.skipped + subjects.skipped,
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

export async function putEvent(db: AppDb, event: EventRecord): Promise<void> {
  await db.put('events', event)
}

// Окончательное удаление: вызывается только после подтверждения пользователя
export async function deleteEventForever(db: AppDb, id: string): Promise<void> {
  await db.delete('events', id)
}

export async function putSubject(db: AppDb, subject: Subject): Promise<void> {
  await db.put('subjects', subject)
}

// Удаление типа и уровня: вызывается только после проверки правил (catalogRules.ts) и подтверждения
export async function putEventType(db: AppDb, type: EventType): Promise<void> {
  await db.put('eventTypes', type)
}

export async function deleteEventTypeForever(db: AppDb, id: string): Promise<void> {
  await db.delete('eventTypes', id)
}

export async function deleteLevelForever(db: AppDb, id: string): Promise<void> {
  await db.delete('importanceLevels', id)
}

export async function putLevels(db: AppDb, levels: ImportanceLevel[]): Promise<void> {
  const tx = db.transaction('importanceLevels', 'readwrite')
  for (const level of levels) void tx.store.put(level)
  await tx.done
}

export interface SeedWrite {
  semesters?: Semester[]
  settings?: Settings
  activeSemesterId?: string
  types: EventType[]
  levels: ImportanceLevel[]
  subjects: Subject[]
  events: EventRecord[]
  catalogSeeded: boolean
  demoSeeded: boolean
}

// Записывает всё сразу одной транзакцией: либо всё, либо ничего
export async function putSeed(db: AppDb, data: SeedWrite): Promise<void> {
  const tx = db.transaction(
    ['semesters', 'settings', 'meta', 'events', 'eventTypes', 'importanceLevels', 'subjects'],
    'readwrite',
  )
  for (const s of data.semesters ?? []) void tx.objectStore('semesters').put(s)
  if (data.settings) void tx.objectStore('settings').put(data.settings, SETTINGS_KEY)
  if (data.activeSemesterId) void tx.objectStore('meta').put(data.activeSemesterId, ACTIVE_KEY)
  for (const t of data.types) void tx.objectStore('eventTypes').put(t)
  for (const l of data.levels) void tx.objectStore('importanceLevels').put(l)
  for (const s of data.subjects) void tx.objectStore('subjects').put(s)
  for (const e of data.events) void tx.objectStore('events').put(e)
  if (data.catalogSeeded) void tx.objectStore('meta').put('1', CATALOG_SEEDED_KEY)
  if (data.demoSeeded) void tx.objectStore('meta').put('1', DEMO_SEEDED_KEY)
  await tx.done
}

// Записывает восстановленные записи одной транзакцией. Ничего не удаляет.
export async function putBackup(db: AppDb, data: BackupData): Promise<void> {
  const tx = db.transaction(['semesters', 'events', 'eventTypes', 'importanceLevels', 'subjects'], 'readwrite')
  for (const s of data.semesters) void tx.objectStore('semesters').put(s)
  for (const e of data.events) void tx.objectStore('events').put(e)
  for (const t of data.types) void tx.objectStore('eventTypes').put(t)
  for (const l of data.levels) void tx.objectStore('importanceLevels').put(l)
  for (const s of data.subjects) void tx.objectStore('subjects').put(s)
  await tx.done
}
