import { useCallback, useEffect, useRef, useState } from 'react'
import type { IsoDate } from '../core/dates'
import {
  createSemester,
  pickActiveId,
  sortSemesters,
  type Semester,
} from '../core/model'
import {
  defaultSemesterDates,
  defaultSettings,
  parseLegacySettings,
  type Settings,
} from '../core/settings'
import { ru } from '../i18n/ru'
import {
  loadAll,
  openAppDb,
  putActiveSemesterId,
  putInitialData,
  putSemester,
  putSettings,
  type AppDb,
} from '../storage/db'
import { readLegacySettingsJson } from '../storage/localSettings'

export type SaveState = 'saved' | 'saving' | 'error'

interface State {
  ready: boolean
  semesters: Semester[]
  settings: Settings
  activeId: string | null
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

export function useAppData() {
  const [state, setState] = useState<State>({
    ready: false,
    semesters: [],
    settings: defaultSettings,
    activeId: null,
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
      let stored = null
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

      if (stored && stored.semesters.length > 0) {
        apply({
          ready: true,
          semesters: sortSemesters(stored.semesters),
          settings: stored.settings ?? defaultSettings,
          activeId: pickActiveId(stored.semesters, stored.activeSemesterId),
        })
        if (!stored.settings) persist((d) => putSettings(d, defaultSettings))
      } else {
        const initial = buildInitialData()
        apply({ ready: true, ...initial })
        persist((d) =>
          putInitialData(d, initial.semesters, initial.settings, initial.activeId),
        )
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
      apply({ ...current, semesters: [...current.semesters, created], activeId: created.id })
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

  const active = state.semesters.find((s) => s.id === state.activeId) ?? null

  return {
    ready: state.ready,
    semesters: state.semesters,
    settings: state.settings,
    active,
    saveState,
    updateSemester,
    updateSettings,
    setActive,
    addSchedule,
    archiveSchedule,
    restoreSchedule,
  }
}
