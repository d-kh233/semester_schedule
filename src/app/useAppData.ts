import { useCallback, useEffect, useRef, useState } from 'react'
import {
  buildLevelsUpTo,
  createSubject,
  recolorLevels,
  sortLevels,
  sortSubjects,
  sortTypes,
  type EventType,
  type ImportanceLevel,
  type Subject,
} from '../core/catalog'
import type { IsoDate } from '../core/dates'
import { createEvent, type EventFields, type EventRecord } from '../core/events'
import { placeLanes, resetLaneIfSpaceChanged } from '../core/layout'
import { createSemester, pickActiveId, sortSemesters, type Semester } from '../core/model'
import type { EventChange } from '../core/parser/apply'
import { planSeed } from '../core/seed'
import {
  defaultSemesterDates,
  defaultSettings,
  parseLegacySettings,
  type Settings,
} from '../core/settings'
import { ru } from '../i18n/ru'
import {
  deleteEventForever,
  loadAll,
  openAppDb,
  putActiveSemesterId,
  putEvent,
  putLevels,
  putSeed,
  putSemester,
  putSettings,
  putSubject,
  type AppDb,
  type StoredData,
} from '../storage/db'
import { readLegacySettingsJson } from '../storage/localSettings'

export type SaveState = 'saved' | 'saving' | 'error'

interface State {
  ready: boolean
  semesters: Semester[]
  settings: Settings
  activeId: string | null
  events: EventRecord[]
  types: EventType[]
  levels: ImportanceLevel[]
  subjects: Subject[]
}

export type SemesterPatch = Partial<
  Pick<
    Semester,
    | 'name'
    | 'startDate'
    | 'endDate'
    | 'weekOneMonday'
    | 'columnWidths'
    | 'monthColumnWidth'
    | 'hiddenMonths'
    | 'archived'
  >
>

function nowIso(): string {
  return new Date().toISOString()
}

// Первый запуск: «Моё расписание» (с датами и палитрой из прежних настроек) и «Демо»
function buildInitialData(): { semesters: Semester[]; settings: Settings; activeId: string } {
  const legacy = parseLegacySettings(readLegacySettingsJson())
  const now = nowIso()
  const personal = createSemester(
    {
      id: crypto.randomUUID(),
      name: ru.schedules.personalName,
      startDate: legacy.semesterStart,
      endDate: legacy.semesterEnd,
    },
    now,
  )
  const demo = createSemester(
    {
      id: crypto.randomUUID(),
      name: ru.schedules.demoName,
      startDate: defaultSemesterDates.start,
      endDate: defaultSemesterDates.end,
      isDemo: true,
    },
    now,
  )
  return { semesters: [personal, demo], settings: legacy.settings, activeId: personal.id }
}

const EMPTY_STORED: StoredData = {
  semesters: [],
  settings: null,
  activeSemesterId: null,
  events: [],
  types: [],
  levels: [],
  subjects: [],
  catalogSeeded: false,
  demoSeeded: false,
  skippedRecords: 0,
}

export function useAppData() {
  const [state, setState] = useState<State>({
    ready: false,
    semesters: [],
    settings: defaultSettings,
    activeId: null,
    events: [],
    types: [],
    levels: [],
    subjects: [],
  })
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const stateRef = useRef(state)
  const dbRef = useRef<AppDb | null>(null)
  const pending = useRef(0)
  const failed = useRef(false)

  const apply = useCallback((next: State) => {
    stateRef.current = next
    setState(next)
  }, [])

  const persist = useCallback((job: (db: AppDb) => Promise<void>) => {
    const db = dbRef.current
    if (!db) {
      failed.current = true
      setSaveState('error')
      return
    }
    pending.current++
    if (!failed.current) setSaveState('saving')
    job(db)
      .catch(() => {
        failed.current = true
      })
      .finally(() => {
        pending.current--
        if (pending.current === 0) setSaveState(failed.current ? 'error' : 'saved')
      })
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let db: AppDb | null = null
      let stored: StoredData | null = null
      try {
        db = await openAppDb()
        stored = await loadAll(db, nowIso())
      } catch {
        // Хранилище недоступно: работаем в памяти и честно предупреждаем, записывать не пытаемся
        failed.current = true
        db = null
        stored = null
      }
      if (cancelled) return
      dbRef.current = db

      const data = stored ?? EMPTY_STORED
      const firstRun = data.semesters.length === 0
      const initial = firstRun ? buildInitialData() : null
      const semesters = sortSemesters(initial?.semesters ?? data.semesters)
      const settings = initial?.settings ?? data.settings ?? defaultSettings

      const seed = planSeed({
        semesters,
        types: data.types,
        levels: data.levels,
        subjects: data.subjects,
        events: data.events,
        catalogSeeded: data.catalogSeeded,
        demoSeeded: data.demoSeeded,
        newId: () => crypto.randomUUID(),
        now: nowIso(),
      })

      // События без дорожки (новые примеры демо, события из прежних версий) получают её здесь;
      // уже расставленные не двигаются
      const allTypes = sortTypes([...data.types, ...seed.types])
      const placed = placeLanes([...data.events, ...seed.events], allTypes, nowIso())
      const seedIds = new Set(seed.events.map((e) => e.id))

      const next: State = {
        ready: true,
        semesters,
        settings,
        activeId: initial?.activeId ?? pickActiveId(semesters, data.activeSemesterId),
        events: placed.events,
        types: allTypes,
        levels: sortLevels([...data.levels, ...seed.levels]),
        subjects: sortSubjects([...data.subjects, ...seed.subjects]),
      }
      apply(next)

      if (firstRun || seed.changed || (!firstRun && !data.settings)) {
        persist((d) =>
          putSeed(d, {
            semesters: firstRun ? semesters : undefined,
            settings: firstRun || !data.settings ? settings : undefined,
            activeSemesterId: firstRun ? (initial?.activeId ?? undefined) : undefined,
            types: seed.types,
            levels: seed.levels,
            subjects: seed.subjects,
            events: placed.events.filter((e) => seedIds.has(e.id)),
            catalogSeeded: seed.catalogSeeded,
            demoSeeded: seed.demoSeeded,
          }),
        )
      }
      const laneUpdates = placed.changed.filter((e) => !seedIds.has(e.id))
      if (laneUpdates.length > 0) {
        persist(async (d) => {
          for (const event of laneUpdates) await putEvent(d, event)
        })
      }
      setSaveState(failed.current ? 'error' : 'saved')
    })()
    return () => {
      cancelled = true
    }
  }, [apply, persist])

  const updateSemester = useCallback(
    (id: string, patch: SemesterPatch) => {
      const current = stateRef.current
      const old = current.semesters.find((s) => s.id === id)
      if (!old) return
      const updated: Semester = { ...old, ...patch, updatedAt: nowIso() }
      apply({
        ...current,
        semesters: current.semesters.map((s) => (s.id === id ? updated : s)),
      })
      persist((db) => putSemester(db, updated))
    },
    [apply, persist],
  )

  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const current = stateRef.current
      const settings = { ...current.settings, ...patch }
      apply({ ...current, settings })
      persist((db) => putSettings(db, settings))
    },
    [apply, persist],
  )

  const setActive = useCallback(
    (id: string) => {
      const current = stateRef.current
      if (!current.semesters.some((s) => s.id === id && !s.archived)) return
      apply({ ...current, activeId: id })
      persist((db) => putActiveSemesterId(db, id))
    },
    [apply, persist],
  )

  const addSchedule = useCallback(
    (name: string, startDate: IsoDate, endDate: IsoDate) => {
      const created = createSemester(
        { id: crypto.randomUUID(), name: name.trim(), startDate, endDate },
        nowIso(),
      )
      const current = stateRef.current
      apply({
        ...current,
        semesters: sortSemesters([...current.semesters, created]),
        activeId: created.id,
      })
      persist(async (db) => {
        await putSemester(db, created)
        await putActiveSemesterId(db, created.id)
      })
    },
    [apply, persist],
  )

  // Расписание уходит в архив, но не удаляется. Единственное расписание в архив не убирается.
  const archiveSchedule = useCallback(
    (id: string) => {
      const current = stateRef.current
      const left = current.semesters.filter((s) => !s.archived && s.id !== id)
      if (left.length === 0) return
      updateSemester(id, { archived: true })
      if (current.activeId === id) {
        const next = pickActiveId(
          current.semesters.map((s) => (s.id === id ? { ...s, archived: true } : s)),
          null,
        )
        if (next) setActive(next)
      }
    },
    [setActive, updateSemester],
  )

  const restoreSchedule = useCallback(
    (id: string) => updateSemester(id, { archived: false }),
    [updateSemester],
  )

  // Единая точка изменения событий: расставляет дорожки (чужие не двигаются; touched уступают
  // при столкновении), сохраняет изменённые и удаляет убранные. Дорожки меняются только у тех,
  // у кого их не было или кто столкнулся (BR-5).
  const commitEvents = useCallback(
    (events: EventRecord[], touched: string[], removed: string[] = []) => {
      const current = stateRef.current
      const placed = placeLanes(events, current.types, nowIso(), { yieldIds: new Set(touched) })
      apply({ ...current, events: placed.events })
      const writeIds = new Set([...touched, ...placed.changed.map((e) => e.id)])
      const toWrite = placed.events.filter((e) => writeIds.has(e.id))
      persist(async (db) => {
        for (const id of removed) await deleteEventForever(db, id)
        for (const event of toWrite) await putEvent(db, event)
      })
    },
    [apply, persist],
  )

  // Новое событие (existing = null) или правка существующего. Дорожка и архив при правке сохраняются.
  const saveEvent = useCallback(
    (existing: EventRecord | null, fields: EventFields, semesterId: string) => {
      const current = stateRef.current
      const now = nowIso()
      const saved: EventRecord = existing
        ? resetLaneIfSpaceChanged(existing, { ...existing, ...fields, updatedAt: now }, current.types)
        : createEvent(fields, { id: crypto.randomUUID(), semesterId }, now)
      const events = existing
        ? current.events.map((e) => (e.id === saved.id ? saved : e))
        : [...current.events, saved]
      commitEvents(events, [saved.id])
    },
    [commitEvents],
  )

  const setEventArchived = useCallback(
    (id: string, archived: boolean) => {
      const current = stateRef.current
      const old = current.events.find((e) => e.id === id)
      if (!old) return
      const updated: EventRecord = { ...old, archived, updatedAt: nowIso() }
      commitEvents(
        current.events.map((e) => (e.id === id ? updated : e)),
        [id],
      )
    },
    [commitEvents],
  )

  // Окончательное удаление: интерфейс вызывает только после явного подтверждения
  const deleteEvent = useCallback(
    (id: string) => {
      commitEvents(
        stateRef.current.events.filter((e) => e.id !== id),
        [],
        [id],
      )
    },
    [commitEvents],
  )

  // Кнопка «Пересортировать»: раскладка расписания заново по правилам 1–5 раздела 9 (BR-5)
  const resortLanes = useCallback(
    (semesterId: string) => {
      const current = stateRef.current
      const placed = placeLanes(current.events, current.types, nowIso(), {
        mode: 'resort',
        semesterId,
      })
      if (placed.changed.length === 0) return
      apply({ ...current, events: placed.events })
      persist(async (db) => {
        for (const event of placed.changed) await putEvent(db, event)
      })
    },
    [apply, persist],
  )

  const addSubject = useCallback(
    (name: string, shortName: string, demo: boolean): Subject => {
      const subject = createSubject({ name, shortName }, crypto.randomUUID(), demo)
      const current = stateRef.current
      apply({ ...current, subjects: sortSubjects([...current.subjects, subject]) })
      persist((db) => putSubject(db, subject))
      return subject
    },
    [apply, persist],
  )

  // Применяет изменения из строки ввода: создание и обновление событий одной операцией
  const applyEventChanges = useCallback(
    (changes: EventChange[]) => {
      const current = stateRef.current
      let events = current.events
      const touched: string[] = []
      for (const change of changes) {
        if (change.kind === 'create') {
          events = [...events, change.event]
          touched.push(change.event.id)
        } else {
          const after = resetLaneIfSpaceChanged(change.before, change.after, current.types)
          events = events.map((e) => (e.id === after.id ? after : e))
          touched.push(after.id)
        }
      }
      commitEvents(events, touched)
    },
    [commitEvents],
  )

  // Отмена только что применённых изменений (кнопка «Отменить» в подсказке)
  const revertEventChanges = useCallback(
    (changes: EventChange[]) => {
      const current = stateRef.current
      let events = current.events
      const touched: string[] = []
      const removed: string[] = []
      for (const change of changes) {
        if (change.kind === 'create') {
          events = events.filter((e) => e.id !== change.event.id)
          removed.push(change.event.id)
        } else {
          events = events.map((e) => (e.id === change.before.id ? change.before : e))
          touched.push(change.before.id)
        }
      }
      commitEvents(events, touched, removed)
    },
    [commitEvents],
  )

  // Создаёт недостающие уровни важности до номера upTo; возвращает общее число уровней
  const addImportanceLevels = useCallback(
    (upTo: number): number => {
      const current = stateRef.current
      const added = buildLevelsUpTo(current.levels, upTo, () => crypto.randomUUID())
      if (added.length === 0) return current.levels.length
      const levels = sortLevels([...current.levels, ...added])
      apply({ ...current, levels })
      persist((db) => putLevels(db, added))
      return levels.length
    },
    [apply, persist],
  )

  // Красит уровни важности по порядку (автосборка палитры, возврат цветов по умолчанию)
  const setLevelColors = useCallback(
    (colors: readonly string[]) => {
      const current = stateRef.current
      const changed = recolorLevels(current.levels, colors)
      if (changed.length === 0) return
      const byId = new Map(changed.map((l) => [l.id, l]))
      apply({ ...current, levels: current.levels.map((l) => byId.get(l.id) ?? l) })
      persist((db) => putLevels(db, changed))
    },
    [apply, persist],
  )

  const active = state.semesters.find((s) => s.id === state.activeId) ?? null

  return {
    ready: state.ready,
    semesters: state.semesters,
    settings: state.settings,
    active,
    events: state.events,
    types: state.types,
    levels: state.levels,
    subjects: state.subjects,
    saveState,
    updateSemester,
    updateSettings,
    setActive,
    addSchedule,
    archiveSchedule,
    restoreSchedule,
    saveEvent,
    setEventArchived,
    deleteEvent,
    resortLanes,
    addSubject,
    applyEventChanges,
    revertEventChanges,
    addImportanceLevels,
    setLevelColors,
  }
}
