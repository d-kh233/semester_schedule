import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog, createSubject } from '../../src/core/catalog'
import { mergeBackup, type BackupData } from '../../src/core/backup'
import { createEvent, type EventRecord } from '../../src/core/events'
import { createSemester } from '../../src/core/model'

let n = 0
const { types, levels } = buildDefaultCatalog(() => `id-${++n}`)
const semester = createSemester(
  { id: 'sem', name: 'Осень', startDate: '2026-09-01', endDate: '2027-01-31' },
  '2026-09-01T00:00:00.000Z',
)
const subject = createSubject({ name: 'Матан', shortName: 'матан' }, 'sub-1', false)

function event(id: string, title: string): EventRecord {
  return createEvent(
    {
      title,
      typeId: types[0]!.id,
      subjectId: null,
      startDate: '2026-10-21',
      endDate: '2026-10-21',
      time: null,
      importance: null,
      note: '',
      done: false,
    },
    { id, semesterId: semester.id },
    '2026-10-01T00:00:00.000Z',
  )
}

const current: BackupData = {
  semesters: [semester],
  events: [event('e1', 'КР 1'), event('e2', 'Тест')],
  types,
  levels,
  subjects: [subject],
}

describe('mergeBackup: слияние по id, ничего не удаляется', () => {
  it('новые записи добавляются, одинаковые ничего не меняют', () => {
    const incoming: BackupData = { ...current, events: [event('e1', 'КР 1'), event('e3', 'Практика')] }
    const result = mergeBackup(current, incoming)
    expect(result.counts.events).toEqual({ created: 1, updated: 0 })
    expect(result.written.events.map((e) => e.id)).toEqual(['e3'])
    expect(result.data.events.map((e) => e.id).sort()).toEqual(['e1', 'e2', 'e3'])
  })

  it('изменённая запись обновляется, а её отсутствие в файле не удаляет', () => {
    const changed = { ...event('e1', 'КР 1 (правка)'), done: true }
    const result = mergeBackup(current, { ...current, events: [changed] })
    expect(result.counts.events).toEqual({ created: 0, updated: 1 })
    expect(result.data.events.find((e) => e.id === 'e1')?.title).toBe('КР 1 (правка)')
    expect(result.data.events.find((e) => e.id === 'e2')).toBeDefined()
  })

  it('пустой файл ничего не меняет', () => {
    const result = mergeBackup(current, { ...current, events: [], semesters: [], types: [], levels: [], subjects: [] })
    expect(result.data).toEqual(current)
    expect(result.written.events).toEqual([])
  })
})

describe('mergeBackup: порядок полей не важен', () => {
  it('та же запись с полями в другом порядке — не обновление', () => {
    const original = event('e1', 'КР 1')
    const reordered = Object.fromEntries(Object.entries(original).reverse()) as unknown as EventRecord
    const result = mergeBackup(current, { ...current, events: [reordered] })
    expect(result.counts.events).toEqual({ created: 0, updated: 0 })
  })
})
