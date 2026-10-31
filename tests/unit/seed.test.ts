import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog, createSubject } from '../../src/core/catalog'
import { createSemester, type Semester } from '../../src/core/model'
import { createEvent } from '../../src/core/events'
import { planSeed } from '../../src/core/seed'

const NOW = '2026-10-31T12:00:00.000Z'
let n = 0
const newId = () => `id-${++n}`

const mine: Semester = createSemester(
  { id: 'mine', name: 'Моё расписание', startDate: '2026-09-01', endDate: '2027-01-31' },
  NOW,
)
const demoSem: Semester = createSemester(
  { id: 'demo', name: 'Демо', startDate: '2026-09-01', endDate: '2027-01-31', isDemo: true },
  NOW,
)

function input(patch: Partial<Parameters<typeof planSeed>[0]> = {}): Parameters<typeof planSeed>[0] {
  return {
    semesters: [mine, demoSem],
    types: [],
    levels: [],
    subjects: [],
    events: [],
    catalogSeeded: false,
    demoSeeded: false,
    newId,
    now: NOW,
    ...patch,
  }
}

const someEvent = (semesterId: string) =>
  createEvent(
    {
      title: 'Т',
      typeId: null,
      subjectId: null,
      startDate: null,
      endDate: null,
      time: null,
      importance: null,
      note: '',
      done: false,
    },
    { id: newId(), semesterId },
    NOW,
  )

describe('planSeed', () => {
  it('первый запуск: справочники и примеры для демо', () => {
    const plan = planSeed(input())
    expect(plan.types.length).toBeGreaterThan(0)
    expect(plan.levels).toHaveLength(3)
    expect(plan.subjects.length).toBeGreaterThan(0)
    expect(plan.events.length).toBeGreaterThan(0)
    expect(plan.events.every((e) => e.semesterId === 'demo')).toBe(true)
    expect(plan.catalogSeeded).toBe(true)
    expect(plan.demoSeeded).toBe(true)
    expect(plan.changed).toBe(true)
  })

  it('личное расписание остаётся пустым', () => {
    const plan = planSeed(input())
    expect(plan.events.some((e) => e.semesterId === 'mine')).toBe(false)
    expect(plan.subjects.every((s) => s.demo)).toBe(true)
  })

  it('справочники уже есть, демо пустое и не засевалось: добавляются только примеры', () => {
    const { types, levels } = buildDefaultCatalog(newId)
    const plan = planSeed(input({ types, levels, catalogSeeded: true }))
    expect(plan.types).toEqual([])
    expect(plan.levels).toEqual([])
    expect(plan.events.length).toBeGreaterThan(0)
    // Примеры ссылаются на существующие типы
    const typeIds = new Set(types.map((t) => t.id))
    for (const e of plan.events) if (e.typeId) expect(typeIds.has(e.typeId)).toBe(true)
  })

  it('всё уже засеяно: ничего не добавляется, даже если события удалены', () => {
    const { types, levels } = buildDefaultCatalog(newId)
    const plan = planSeed(input({ types, levels, catalogSeeded: true, demoSeeded: true }))
    expect(plan.types).toEqual([])
    expect(plan.levels).toEqual([])
    expect(plan.subjects).toEqual([])
    expect(plan.events).toEqual([])
    expect(plan.changed).toBe(false)
  })

  it('в демо уже есть события: примеры не дублируются, флаг ставится', () => {
    const { types, levels } = buildDefaultCatalog(newId)
    const plan = planSeed(
      input({ types, levels, catalogSeeded: true, events: [someEvent('demo')] }),
    )
    expect(plan.events).toEqual([])
    expect(plan.demoSeeded).toBe(true)
    expect(plan.changed).toBe(true)
  })

  it('события только в личном расписании не мешают засеять демо', () => {
    const { types, levels } = buildDefaultCatalog(newId)
    const plan = planSeed(
      input({ types, levels, catalogSeeded: true, events: [someEvent('mine')] }),
    )
    expect(plan.events.length).toBeGreaterThan(0)
  })

  it('демо-расписания нет: примеры не добавляются, флаг не ставится', () => {
    const plan = planSeed(input({ semesters: [mine] }))
    expect(plan.events).toEqual([])
    expect(plan.demoSeeded).toBe(false)
    expect(plan.catalogSeeded).toBe(true)
  })

  it('справочники есть, но флага нет: не засеваются заново, флаг ставится', () => {
    const { types, levels } = buildDefaultCatalog(newId)
    const plan = planSeed(input({ types, levels, subjects: [createSubject({ name: 'А', shortName: 'а' }, 's', false)] }))
    expect(plan.types).toEqual([])
    expect(plan.levels).toEqual([])
    expect(plan.catalogSeeded).toBe(true)
  })
})
