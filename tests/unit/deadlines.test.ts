import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog, createSubject } from '../../src/core/catalog'
import {
  dayMonthText,
  sortDeadlines,
  subjectListText,
  undatedEvents,
} from '../../src/core/deadlines'
import type { EventRecord } from '../../src/core/events'

const NOW = '2026-10-31T12:00:00.000Z'
let n = 0
const { types } = buildDefaultCatalog(() => `type-${++n}`)
const kr = types.find((t) => t.name === 'КР')!
const practice = types.find((t) => t.name === 'Практика')!
const english = createSubject({ name: 'Англ. яз.', shortName: 'англ' }, 'sub-eng', false)
const matan = { ...createSubject({ name: 'Матан', shortName: 'матан' }, 'sub-matan', false), weight: 3 }

function event(patch: Partial<EventRecord> = {}): EventRecord {
  return {
    id: 'e',
    semesterId: 's',
    title: 'Событие',
    typeId: null,
    subjectId: null,
    startDate: '2026-11-10',
    endDate: '2026-11-10',
    time: null,
    importance: null,
    lane: null,
    note: '',
    done: false,
    completedAt: null,
    archived: false,
    effort: null,
    windows: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  }
}

const ids = (list: EventRecord[]) => list.map((e) => e.id)

describe('sortDeadlines (список дедлайнов)', () => {
  it('раньше дата конца — выше', () => {
    const late = event({ id: 'late', endDate: '2026-12-01' })
    const early = event({ id: 'early', endDate: '2026-11-01' })
    expect(ids(sortDeadlines([late, early], types, []))).toEqual(['early', 'late'])
  })

  it('при равной дате выше важнее: 1 выше 2, без важности ниже всех', () => {
    const none = event({ id: 'none', typeId: null, importance: null })
    const two = event({ id: 'two', importance: 2 })
    const one = event({ id: 'one', importance: 1 })
    expect(ids(sortDeadlines([none, two, one], types, []))).toEqual(['one', 'two', 'none'])
  })

  it('важность берётся от типа, если ручной нет (КР = 1)', () => {
    const practiceEvent = event({ id: 'pr', typeId: practice.id })
    const krEvent = event({ id: 'kr', typeId: kr.id })
    expect(ids(sortDeadlines([practiceEvent, krEvent], types, []))).toEqual(['kr', 'pr'])
  })

  it('при равной важности выше тот, у кого вес предмета больше', () => {
    const lightSubject = event({ id: 'light', subjectId: english.id, importance: 2 })
    const heavySubject = event({ id: 'heavy', subjectId: matan.id, importance: 2 })
    const subjects = [english, matan]
    expect(ids(sortDeadlines([lightSubject, heavySubject], types, subjects))).toEqual([
      'heavy',
      'light',
    ])
  })

  it('выполненные уходят вниз, даже если их дата раньше', () => {
    const doneEarly = event({ id: 'done', endDate: '2026-11-01', done: true })
    const open = event({ id: 'open', endDate: '2026-12-01' })
    expect(ids(sortDeadlines([doneEarly, open], types, []))).toEqual(['open', 'done'])
  })

  it('без даты и архивные в список не попадают', () => {
    const undated = event({ id: 'undated', startDate: null, endDate: null })
    const archived = event({ id: 'archived', archived: true })
    const live = event({ id: 'live' })
    expect(ids(sortDeadlines([undated, archived, live], types, []))).toEqual(['live'])
  })

  it('порядок по важности меняется с направлением «наибольшая цифра главная»', () => {
    const one = event({ id: 'one', importance: 1 })
    const three = event({ id: 'three', importance: 3 })
    expect(ids(sortDeadlines([one, three], types, [], 'max'))).toEqual(['three', 'one'])
  })
})

describe('undatedEvents (раздел «Когда-нибудь»)', () => {
  it('только живые события без даты', () => {
    const undated = event({ id: 'u', startDate: null, endDate: null })
    const dated = event({ id: 'd' })
    const archivedUndated = event({ id: 'a', startDate: null, endDate: null, archived: true })
    expect(ids(undatedEvents([undated, dated, archivedUndated]))).toEqual(['u'])
  })
})

describe('dayMonthText', () => {
  it('дата ДД.ММ без года, как в примере ТЗ', () => {
    expect(dayMonthText('2026-02-12')).toBe('12.02')
  })
})

describe('subjectListText (копирование списка по предмету, раздел 11 ТЗ)', () => {
  const list = [
    event({ id: 'late', subjectId: english.id, typeId: kr.id, endDate: '2026-12-12', startDate: '2026-12-12' }),
    event({ id: 'early', subjectId: english.id, typeId: kr.id, endDate: '2026-02-12', startDate: '2026-02-12' }),
    event({ id: 'named', subjectId: english.id, title: 'Эссе', endDate: '2026-03-01', startDate: '2026-03-01', time: '17:00' }),
    event({ id: 'other', subjectId: matan.id, typeId: kr.id, endDate: '2026-02-01', startDate: '2026-02-01' }),
    event({ id: 'archived', subjectId: english.id, archived: true, endDate: '2026-01-01', startDate: '2026-01-01' }),
    event({ id: 'undated', subjectId: english.id, startDate: null, endDate: null }),
  ]

  it('заголовок предмета, затем нумерованный список по возрастанию дат', () => {
    expect(subjectListText(english, list, types, null)).toBe(
      ['Англ. яз.:', '1. КР 12.02', '2. Эссе 01.03 17:00', '3. КР 12.12'].join('\n'),
    )
  })

  it('без типа берётся название события', () => {
    const text = subjectListText(english, list, types, null)
    expect(text).toContain('2. Эссе 01.03 17:00')
  })

  it('до выбранной даты включительно, позже не попадает', () => {
    expect(subjectListText(english, list, types, '2026-03-01')).toBe(
      ['Англ. яз.:', '1. КР 12.02', '2. Эссе 01.03 17:00'].join('\n'),
    )
  })

  it('у предмета без дедлайнов только заголовок', () => {
    expect(subjectListText(matan, [], types, null)).toBe('Матан:')
  })
})
