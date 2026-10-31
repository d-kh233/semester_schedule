import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog } from '../../src/core/catalog'
import { buildDemoData } from '../../src/core/demo'
import { compareIsoDates } from '../../src/core/dates'

const NOW = '2026-10-31T12:00:00.000Z'
let n = 0
const newId = () => `id-${++n}`
const { types } = buildDefaultCatalog(newId)
const START = '2026-09-01'
const END = '2027-01-31'
const demo = buildDemoData({ semesterId: 'demo-sem', types, startDate: START, newId, now: NOW })

describe('buildDemoData (примеры для демо-расписания)', () => {
  it('предметы из условий тестов ТЗ помечены как демо', () => {
    expect(demo.subjects.map((s) => s.name)).toEqual(['Матан', 'Англ. яз.', 'СИИБД', 'Физра'])
    expect(demo.subjects.map((s) => s.shortName)).toEqual(['матан', 'англ', 'сиибд', 'физра'])
    expect(demo.subjects.every((s) => s.demo)).toBe(true)
  })

  it('все события принадлежат демо-расписанию и имеют названия', () => {
    expect(demo.events.length).toBeGreaterThanOrEqual(8)
    for (const e of demo.events) {
      expect(e.semesterId).toBe('demo-sem')
      expect(e.title.trim()).not.toBe('')
    }
  })

  it('все даты внутри семестра демо', () => {
    for (const e of demo.events) {
      for (const date of [e.startDate, e.endDate]) {
        if (date === null) continue
        expect(compareIsoDates(date, START)).toBeGreaterThanOrEqual(0)
        expect(compareIsoDates(date, END)).toBeLessThanOrEqual(0)
      }
    }
  })

  it('есть хакатон через границу месяцев (13.10–15.11)', () => {
    const hack = demo.events.find((e) => e.title === 'Хакатон')
    expect(hack?.startDate).toBe('2026-10-13')
    expect(hack?.endDate).toBe('2026-11-15')
  })

  it('есть событие без даты, событие без типа и важности, выполненное и с временем', () => {
    expect(demo.events.some((e) => e.startDate === null)).toBe(true)
    expect(demo.events.some((e) => e.typeId === null && e.importance === null)).toBe(true)
    expect(demo.events.some((e) => e.done)).toBe(true)
    expect(demo.events.some((e) => e.time === '17:00')).toBe(true)
  })

  it('есть КР на 21.10 и событие 28.10–03.11', () => {
    expect(demo.events.some((e) => e.title === 'Матан КР' && e.endDate === '2026-10-21')).toBe(true)
    expect(demo.events.some((e) => e.startDate === '2026-10-28' && e.endDate === '2026-11-03')).toBe(true)
  })

  it('типы и предметы в событиях существуют', () => {
    const typeIds = new Set(types.map((t) => t.id))
    const subjectIds = new Set(demo.subjects.map((s) => s.id))
    for (const e of demo.events) {
      if (e.typeId !== null) expect(typeIds.has(e.typeId)).toBe(true)
      if (e.subjectId !== null) expect(subjectIds.has(e.subjectId)).toBe(true)
    }
  })

  it('id всех событий и предметов разные', () => {
    const ids = [...demo.events.map((e) => e.id), ...demo.subjects.map((s) => s.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })
})
