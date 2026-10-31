// Что нужно добавить при запуске: справочники по умолчанию и примеры для демо.
// Правило безопасности: ничего не удаляется и не дублируется, засеваем один раз (флаги).

import {
  buildDefaultCatalog,
  type EventType,
  type ImportanceLevel,
  type Subject,
} from './catalog'
import { buildDemoData } from './demo'
import type { EventRecord } from './events'
import type { Semester } from './model'

interface SeedInput {
  semesters: Semester[]
  types: EventType[]
  levels: ImportanceLevel[]
  subjects: Subject[]
  events: EventRecord[]
  catalogSeeded: boolean
  demoSeeded: boolean
  newId: () => string
  now: string
}

export interface SeedPlan {
  // Новые записи, которые нужно добавить
  types: EventType[]
  levels: ImportanceLevel[]
  subjects: Subject[]
  events: EventRecord[]
  catalogSeeded: boolean
  demoSeeded: boolean
  // Есть ли что записать в хранилище
  changed: boolean
}

export function planSeed(input: SeedInput): SeedPlan {
  let types: EventType[] = []
  let levels: ImportanceLevel[] = []
  if (!input.catalogSeeded && input.types.length === 0 && input.levels.length === 0) {
    const catalog = buildDefaultCatalog(input.newId)
    types = catalog.types
    levels = catalog.levels
  }
  const allTypes = [...input.types, ...types]

  let subjects: Subject[] = []
  let events: EventRecord[] = []
  let demoSeeded = input.demoSeeded
  const demo = input.semesters.find((s) => s.isDemo)
  if (!demoSeeded && demo) {
    if (!input.events.some((e) => e.semesterId === demo.id)) {
      const data = buildDemoData({
        semesterId: demo.id,
        types: allTypes,
        startDate: demo.startDate,
        newId: input.newId,
        now: input.now,
      })
      subjects = data.subjects
      events = data.events
    }
    demoSeeded = true
  }

  return {
    types,
    levels,
    subjects,
    events,
    catalogSeeded: true,
    demoSeeded,
    changed: !input.catalogSeeded || demoSeeded !== input.demoSeeded,
  }
}
