import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog } from '../../src/core/catalog'
import { createEvent, type EventRecord, type EventWindow } from '../../src/core/events'
import { placeLanes, type PlaceOptions } from '../../src/core/layout'

let counter = 0
const { types } = buildDefaultCatalog(() => `id-${++counter}`)
const typeId = (name: string): string | null => types.find((t) => t.name === name)?.id ?? null

const NOW = '2026-10-31T12:00:00.000Z'
const d = (monthDay: string) => `2026-${monthDay}`

interface Spec {
  id: string
  start?: string | null
  end?: string | null
  type?: string
  importance?: number | null
  lane?: number | null
  created?: string
  archived?: boolean
  windows?: EventWindow[]
}

function ev(spec: Spec): EventRecord {
  const start = spec.start === undefined ? null : spec.start
  const end = spec.end === undefined ? start : spec.end
  const event = createEvent(
    {
      title: spec.id,
      typeId: spec.type ? typeId(spec.type) : null,
      subjectId: null,
      startDate: start,
      endDate: end,
      time: null,
      importance: spec.importance ?? null,
      note: '',
      done: false,
    },
    { id: spec.id, semesterId: 'sem' },
    spec.created ?? '2026-10-01T00:00:00.000Z',
    spec.windows,
  )
  return { ...event, lane: spec.lane ?? null, archived: spec.archived ?? false }
}

function lanes(events: EventRecord[], options?: PlaceOptions): Record<string, number | null> {
  const result = placeLanes(events, types, NOW, options)
  return Object.fromEntries(result.events.map((e) => [e.id, e.lane]))
}

describe('раскладка: дедлайны (раздел 9, пп. 1–3)', () => {
  it('GC-1: два события в один день лежат на разных строках', () => {
    const l = lanes([
      ev({ id: 'a', start: d('10-21') }),
      ev({ id: 'b', start: d('10-21'), created: '2026-10-02T00:00:00.000Z' }),
    ])
    expect(l.a).not.toBe(l.b)
    expect([l.a, l.b].sort()).toEqual([0, 1])
  })

  it('GC-2: без пересечений все события на одной строке', () => {
    const l = lanes([
      ev({ id: 'a', start: d('10-21') }),
      ev({ id: 'b', start: d('10-22') }),
      ev({ id: 'c', start: d('11-05'), end: d('11-07') }),
    ])
    expect(l).toEqual({ a: 0, b: 0, c: 0 })
  })

  it('GC-4: КР выше практики на одну дату (важность 1 против 2)', () => {
    const l = lanes([
      ev({ id: 'practice', start: d('11-10'), type: 'Практика', created: '2026-10-01T00:00:00.000Z' }),
      ev({ id: 'kr', start: d('11-10'), type: 'КР', created: '2026-10-05T00:00:00.000Z' }),
    ])
    expect(l.kr).toBe(0)
    expect(l.practice).toBe(1)
  })

  it('BR-4: при равной дате выше важнее, без важности ниже всех', () => {
    const l = lanes([
      ev({ id: 'none', start: d('10-21') }),
      ev({ id: 'three', start: d('10-21'), importance: 3 }),
      ev({ id: 'one', start: d('10-21'), importance: 1 }),
      ev({ id: 'two', start: d('10-21'), importance: 2 }),
    ])
    expect(l).toEqual({ one: 0, two: 1, three: 2, none: 3 })
  })

  it('BR-4: при равной дате и важности выше то, что создано раньше', () => {
    const l = lanes([
      ev({ id: 'late', start: d('10-21'), importance: 1, created: '2026-10-09T00:00:00.000Z' }),
      ev({ id: 'early', start: d('10-21'), importance: 1, created: '2026-10-03T00:00:00.000Z' }),
    ])
    expect(l.early).toBe(0)
    expect(l.late).toBe(1)
  })

  it('полное равенство (одна строка ввода «а 21.10; б 21.10»): порядок как при вводе, а не по id', () => {
    const same = '2026-10-31T12:00:00.000Z'
    const l = lanes([
      ev({ id: 'zzz', start: d('10-21'), created: same }),
      ev({ id: 'aaa', start: d('10-21'), created: same }),
    ])
    expect(l.zzz).toBe(0)
    expect(l.aaa).toBe(1)
  })

  it('раньше дата конца — выше строка, если события пересекаются', () => {
    const l = lanes([
      ev({ id: 'long', start: d('10-20'), end: d('10-30') }),
      ev({ id: 'short', start: d('10-22'), end: d('10-23') }),
    ])
    expect(l.short).toBe(0)
    expect(l.long).toBe(1)
  })

  it('событие берёт наименьшую дорожку, свободную на всех днях протяжения', () => {
    const l = lanes([
      ev({ id: 'a', start: d('10-20'), end: d('10-22') }),
      ev({ id: 'b', start: d('10-21'), end: d('10-23') }),
      ev({ id: 'c', start: d('10-23'), end: d('10-24') }),
    ])
    // c пересекается только с b (23.10), поэтому встаёт на дорожку a
    expect(l).toEqual({ a: 0, b: 1, c: 0 })
  })

  it('GC-6: событие 28.10–03.11 одно, у него одна дорожка на оба месяца', () => {
    const l = lanes([
      ev({ id: 'x', start: d('10-28'), end: d('11-03') }),
      ev({ id: 'y', start: d('10-30') }),
    ])
    expect(l.y).toBe(0)
    expect(l.x).toBe(1)
  })

  it('архивные и безвременные события дорожку не занимают и не получают', () => {
    const l = lanes([
      ev({ id: 'arch', start: d('10-21'), archived: true }),
      ev({ id: 'nodate' }),
      ev({ id: 'live', start: d('10-21') }),
    ])
    expect(l.live).toBe(0)
    expect(l.arch).toBeNull()
    expect(l.nodate).toBeNull()
  })

  it('пустой список не ломает раскладку', () => {
    expect(placeLanes([], types, NOW)).toEqual({ events: [], changed: [] })
  })
})

describe('раскладка: постоянство и новые события (BR-5, GC-5, GC-8)', () => {
  it('GC-5: новое событие раньше существующих не сдвигает старые', () => {
    const existing = [
      ev({ id: 'old1', start: d('10-21'), lane: 0, created: '2026-10-01T00:00:00.000Z' }),
      ev({ id: 'old2', start: d('10-21'), lane: 1, created: '2026-10-01T00:00:01.000Z' }),
    ]
    const fresh = ev({ id: 'new', start: d('10-15'), end: d('10-22'), created: '2026-10-30T00:00:00.000Z' })
    const result = placeLanes([...existing, fresh], types, NOW)
    const l = Object.fromEntries(result.events.map((e) => [e.id, e.lane]))
    expect(l.old1).toBe(0)
    expect(l.old2).toBe(1)
    expect(l.new).toBe(2)
    expect(result.changed.map((e) => e.id)).toEqual(['new'])
  })

  it('новое событие занимает свободную дорожку между занятыми', () => {
    const l = lanes([
      ev({ id: 'a', start: d('10-21'), lane: 0 }),
      ev({ id: 'c', start: d('10-21'), lane: 2 }),
      ev({ id: 'new', start: d('10-21'), created: '2026-10-30T00:00:00.000Z' }),
    ])
    expect(l.new).toBe(1)
  })

  it('освободившееся место выше не затягивает событие (дорожка постоянная)', () => {
    const l = lanes([ev({ id: 'low', start: d('10-21'), lane: 3 })])
    expect(l.low).toBe(3)
  })

  it('уже расставленные события не попадают в changed', () => {
    const result = placeLanes([ev({ id: 'a', start: d('10-21'), lane: 0 })], types, NOW)
    expect(result.changed).toEqual([])
  })

  it('у изменённого события обновляется updatedAt, у остальных нет', () => {
    const result = placeLanes(
      [ev({ id: 'a', start: d('10-21'), lane: 0 }), ev({ id: 'b', start: d('10-21') })],
      types,
      NOW,
    )
    expect(result.events.find((e) => e.id === 'b')?.updatedAt).toBe(NOW)
    expect(result.events.find((e) => e.id === 'a')?.updatedAt).toBe('2026-10-01T00:00:00.000Z')
  })

  it('GC-8: событие, вернувшееся из архива или после отмены удаления, встаёт на ту же строку', () => {
    const a = ev({ id: 'a', start: d('10-21'), lane: 0 })
    const b = ev({ id: 'b', start: d('10-21'), lane: 1 })
    // b удалили, a осталось; потом b вернули записью с сохранённой дорожкой
    expect(lanes([a])).toEqual({ a: 0 })
    expect(lanes([a, b])).toEqual({ a: 0, b: 1 })
    // вернули из архива, место свободно: дорожка прежняя, хотя выше было бы свободно
    const archived = { ...b, archived: true }
    const restored = ev({ id: 'b', start: d('10-21'), lane: 1 })
    expect(lanes([archived]).b).toBe(1)
    expect(lanes([restored]).b).toBe(1)
  })

  it('вернули из архива, а место занято: возвращаемое уступает', () => {
    const occupant = ev({ id: 'occ', start: d('10-21'), lane: 1, created: '2026-10-20T00:00:00.000Z' })
    const restored = ev({ id: 'back', start: d('10-21'), lane: 1, created: '2026-10-01T00:00:00.000Z' })
    const l = lanes([occupant, restored], { yieldIds: new Set(['back']) })
    expect(l.occ).toBe(1)
    expect(l.back).toBe(0)
  })

  it('столкновение сохранённых дорожек: старое остаётся, новое переезжает', () => {
    const l = lanes([
      ev({ id: 'old', start: d('10-21'), lane: 0, created: '2026-10-01T00:00:00.000Z' }),
      ev({ id: 'young', start: d('10-21'), lane: 0, created: '2026-10-09T00:00:00.000Z' }),
    ])
    expect(l.old).toBe(0)
    expect(l.young).toBe(1)
  })

  it('события разных расписаний друг другу не мешают', () => {
    const other = { ...ev({ id: 'other', start: d('10-21') }), semesterId: 'sem2' }
    const l = lanes([ev({ id: 'mine', start: d('10-21') }), other])
    expect(l).toEqual({ mine: 0, other: 0 })
  })
})

describe('раскладка: пересортировка по кнопке (п. 7)', () => {
  it('fill не подтягивает события вверх, resort раскладывает заново', () => {
    const events = [
      ev({ id: 'a', start: d('10-21'), lane: 2 }),
      ev({ id: 'b', start: d('10-21'), lane: 5 }),
    ]
    expect(lanes(events)).toEqual({ a: 2, b: 5 })
    expect(lanes(events, { mode: 'resort' })).toEqual({ a: 0, b: 1 })
  })

  it('resort следует правилам: по дате конца, затем по важности', () => {
    const events = [
      ev({ id: 'low', start: d('10-21'), importance: 3, lane: 0 }),
      ev({ id: 'high', start: d('10-21'), importance: 1, lane: 1 }),
    ]
    expect(lanes(events, { mode: 'resort' })).toEqual({ high: 0, low: 1 })
  })

  it('resort с semesterId не трогает другие расписания', () => {
    const other = { ...ev({ id: 'other', start: d('10-21'), lane: 4 }), semesterId: 'sem2' }
    const l = lanes([ev({ id: 'mine', start: d('10-21'), lane: 3 }), other], {
      mode: 'resort',
      semesterId: 'sem',
    })
    expect(l).toEqual({ mine: 0, other: 4 })
  })
})

describe('раскладка: фоновые события (BR-7, п. 4)', () => {
  it('фоновые лежат в своём наборе дорожек и не мешают дедлайнам', () => {
    const l = lanes([
      ev({ id: 'hack', start: d('10-13'), end: d('11-15'), type: 'Хакатон' }),
      ev({ id: 'kr', start: d('10-20'), type: 'КР' }),
    ])
    expect(l.kr).toBe(0)
    expect(l.hack).toBe(0)
  })

  it('фоновые друг под другом по дате начала', () => {
    const l = lanes([
      ev({ id: 'later', start: d('10-20'), end: d('11-30'), type: 'Хакатон' }),
      ev({ id: 'earlier', start: d('10-13'), end: d('12-05'), type: 'Подготовка к экзаменам' }),
    ])
    expect(l.earlier).toBe(0)
    expect(l.later).toBe(1)
  })

  it('фоновые, не пересекающиеся по дням, делят одну линию', () => {
    const l = lanes([
      ev({ id: 'h1', start: d('10-01'), end: d('10-10'), type: 'Хакатон' }),
      ev({ id: 'h2', start: d('11-01'), end: d('11-10'), type: 'Хакатон' }),
    ])
    expect(l).toEqual({ h1: 0, h2: 0 })
  })
})

describe('раскладка: практика с окнами (п. 6)', () => {
  const windows: EventWindow[] = [
    { startDate: d('11-10'), endDate: d('11-10'), planned: true },
    { startDate: d('11-24'), endDate: d('11-24'), planned: false },
  ]

  it('занимаются только дни окон, дни между окнами свободны', () => {
    const l = lanes([
      ev({ id: 'practice', start: d('11-10'), end: d('11-24'), type: 'Практика', windows }),
      ev({ id: 'between', start: d('11-15'), end: d('11-16') }),
    ])
    expect(l.practice).toBe(0)
    expect(l.between).toBe(0)
  })

  it('окно, совпавшее по дню с другим событием, уводит практику на другую дорожку', () => {
    const l = lanes([
      ev({ id: 'kr', start: d('11-24'), type: 'КР' }),
      ev({ id: 'practice', start: d('11-10'), end: d('11-24'), type: 'Практика', windows }),
    ])
    expect(l.kr).toBe(0)
    expect(l.practice).toBe(1)
  })
})
