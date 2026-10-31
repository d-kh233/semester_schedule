import { describe, expect, it } from 'vitest'
import { buildCalendar } from '../../src/core/calendar'
import { buildDefaultCatalog } from '../../src/core/catalog'
import { createEvent, type EventRecord, type EventWindow } from '../../src/core/events'
import { buildMonthLayouts, type MonthLayout } from '../../src/core/gridBlocks'
import { placeLanes } from '../../src/core/layout'

let counter = 0
const { types, levels } = buildDefaultCatalog(() => `id-${++counter}`)
const typeId = (name: string): string | null => types.find((t) => t.name === name)?.id ?? null

const NOW = '2026-10-31T12:00:00.000Z'
const TODAY = '2026-10-31'
const months = buildCalendar('2026-09-01', '2027-01-31')
const d = (monthDay: string) => `2026-${monthDay}`

interface Spec {
  id: string
  start?: string | null
  end?: string | null
  type?: string
  importance?: number | null
  done?: boolean
  archived?: boolean
  windows?: EventWindow[]
  created?: string
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
      done: spec.done ?? false,
    },
    { id: spec.id, semesterId: 'sem' },
    spec.created ?? '2026-10-01T00:00:00.000Z',
    spec.windows,
  )
  return { ...event, archived: spec.archived ?? false }
}

function layouts(specs: Spec[], crowdedDays = 7): Map<string, MonthLayout> {
  const placed = placeLanes(specs.map(ev), types, NOW).events
  const list = buildMonthLayouts({ months, events: placed, types, levels, today: TODAY, crowdedDays })
  return new Map(list.map((m) => [m.key, m]))
}

function block(map: Map<string, MonthLayout>, month: string, eventId: string, windowIndex: number | null = null) {
  return map.get(month)?.blocks.find((b) => b.eventId === eventId && b.windowIndex === windowIndex)
}

describe('блоки сетки: строки месяца', () => {
  it('GC-2: пустой месяц и месяц без пересечений имеют одну строку', () => {
    const map = layouts([
      { id: 'a', start: d('10-21') },
      { id: 'b', start: d('10-22') },
    ])
    expect(map.get('2026-09')?.rows).toBe(1)
    expect(map.get('2026-10')?.rows).toBe(1)
    expect(map.get('2026-10')?.blocks).toHaveLength(2)
  })

  it('GC-1: два события в один день дают две строки месяца', () => {
    const map = layouts([
      { id: 'a', start: d('10-21') },
      { id: 'b', start: d('10-21') },
    ])
    expect(map.get('2026-10')?.rows).toBe(2)
    expect(map.get('2026-11')?.rows).toBe(1)
    const rows = map.get('2026-10')?.blocks.map((b) => b.row).sort()
    expect(rows).toEqual([0, 1])
  })

  it('GC-3: КР выше, хакатон в нижней строке обоих месяцев цельной полосой', () => {
    const map = layouts([
      { id: 'kr', start: d('10-20'), type: 'КР' },
      { id: 'hack', start: d('10-13'), end: d('11-15'), type: 'Хакатон' },
    ])
    expect(map.get('2026-10')?.rows).toBe(2)
    expect(block(map, '2026-10', 'kr')?.row).toBe(0)
    const oct = block(map, '2026-10', 'hack')
    expect(oct).toMatchObject({ row: 1, startDay: 13, endDay: 31, continuesLeft: false, continuesRight: true })
    expect(oct?.background).toBe(true)

    // в ноябре дедлайнов нет, хакатон один и занимает единственную строку
    expect(map.get('2026-11')?.rows).toBe(1)
    expect(block(map, '2026-11', 'hack')).toMatchObject({
      row: 0,
      startDay: 1,
      endDay: 15,
      continuesLeft: true,
      continuesRight: false,
    })
  })

  it('фоновая линия идёт под самой нижней дорожкой дедлайнов месяца', () => {
    const map = layouts([
      { id: 'a', start: d('11-05') },
      { id: 'b', start: d('11-05') },
      { id: 'c', start: d('11-05') },
      { id: 'hack', start: d('10-13'), end: d('11-15'), type: 'Хакатон' },
    ])
    expect(map.get('2026-11')?.rows).toBe(4)
    expect(block(map, '2026-11', 'hack')?.row).toBe(3)
  })

  it('GC-6: событие 28.10–03.11 — один блок на месяц и одна строка в обоих месяцах', () => {
    const map = layouts([{ id: 'x', start: d('10-28'), end: d('11-03') }])
    expect(block(map, '2026-10', 'x')).toMatchObject({ row: 0, startDay: 28, endDay: 31 })
    expect(block(map, '2026-11', 'x')).toMatchObject({ row: 0, startDay: 1, endDay: 3 })
    expect(map.get('2026-10')?.rows).toBe(1)
    expect(map.get('2026-11')?.rows).toBe(1)
  })

  it('GC-7: блок не заходит на несуществующее 31 ноября', () => {
    const map = layouts([{ id: 'x', start: d('11-29'), end: d('12-02') }])
    expect(block(map, '2026-11', 'x')).toMatchObject({ startDay: 29, endDay: 30 })
    expect(block(map, '2026-12', 'x')).toMatchObject({ startDay: 1, endDay: 2 })
  })

  it('события вне семестра обрезаются по его границам', () => {
    const map = layouts([
      { id: 'before', start: '2026-08-20', end: '2026-09-03' },
      { id: 'outside', start: '2026-07-01', end: '2026-07-05' },
    ])
    expect(block(map, '2026-09', 'before')).toMatchObject({ startDay: 1, endDay: 3, continuesLeft: true })
    expect(map.has('2026-08')).toBe(false)
    expect(map.get('2026-09')?.blocks.some((b) => b.eventId === 'outside')).toBe(false)
  })

  it('архивные и безвременные события блоков не дают', () => {
    const map = layouts([
      { id: 'arch', start: d('10-21'), archived: true },
      { id: 'nodate' },
    ])
    expect([...map.values()].every((m) => m.blocks.length === 0)).toBe(true)
  })
})

describe('блоки сетки: цвет и вид', () => {
  it('цвет по важности: тип КР даёт уровень 1, ручная цифра перебивает', () => {
    const map = layouts([
      { id: 'kr', start: d('10-21'), type: 'КР' },
      { id: 'manual', start: d('10-22'), type: 'КР', importance: 3 },
    ])
    expect(block(map, '2026-10', 'kr')?.color).toBe(levels.find((l) => l.number === 1)?.color)
    expect(block(map, '2026-10', 'manual')?.color).toBe(levels.find((l) => l.number === 3)?.color)
  })

  it('хакатон окрашен цветом своего типа', () => {
    const map = layouts([{ id: 'hack', start: d('10-13'), end: d('10-20'), type: 'Хакатон' }])
    expect(block(map, '2026-10', 'hack')?.color).toBe('#f0a03c')
  })

  it('GC-11: без важности и типа блок бесцветный', () => {
    const map = layouts([{ id: 'plain', start: d('10-21') }])
    expect(block(map, '2026-10', 'plain')?.color).toBeNull()
  })

  it('подпись блока — название события', () => {
    const map = layouts([{ id: 'СИИБД КР', start: d('10-21') }])
    expect(block(map, '2026-10', 'СИИБД КР')?.label).toBe('СИИБД КР')
  })

  it('GC-14: блок прошедших дней помечен прошедшим, сегодняшний и будущий нет', () => {
    const map = layouts([
      { id: 'past', start: d('10-30') },
      { id: 'today', start: d('10-31') },
      { id: 'future', start: d('11-01') },
      { id: 'spans', start: d('10-28'), end: d('11-03') },
    ])
    expect(block(map, '2026-10', 'past')?.past).toBe(true)
    expect(block(map, '2026-10', 'today')?.past).toBe(false)
    expect(block(map, '2026-11', 'future')?.past).toBe(false)
    expect(block(map, '2026-10', 'spans')?.past).toBe(false)
  })

  it('GC-15: выполненное событие помечено выполненным', () => {
    const map = layouts([
      { id: 'done', start: d('11-05'), done: true },
      { id: 'open', start: d('11-06') },
    ])
    expect(block(map, '2026-11', 'done')?.done).toBe(true)
    expect(block(map, '2026-11', 'open')?.done).toBe(false)
  })
})

describe('блоки сетки: окна практики (BR-8)', () => {
  const windows: EventWindow[] = [
    { startDate: d('11-10'), endDate: d('11-10'), planned: true },
    { startDate: d('11-24'), endDate: d('11-24'), planned: false },
  ]
  const practice: Spec = {
    id: 'ПР',
    start: d('11-10'),
    end: d('11-24'),
    type: 'Практика',
    windows,
  }

  it('каждое окно — отдельный блок со своей подписью', () => {
    const map = layouts([practice])
    const nov = map.get('2026-11')?.blocks ?? []
    expect(nov).toHaveLength(2)
    expect(block(map, '2026-11', 'ПР', 0)).toMatchObject({ startDay: 10, endDay: 10, label: 'ПР' })
    expect(block(map, '2026-11', 'ПР', 1)).toMatchObject({ startDay: 24, endDay: 24, label: 'ПР' })
    expect(new Set(nov.map((b) => b.key)).size).toBe(2)
    // все окна одного события на одной строке
    expect(nov[0]?.row).toBe(nov[1]?.row)
  })

  it('GC-12: планируемое окно с акцентом, второе без', () => {
    const map = layouts([practice])
    expect(block(map, '2026-11', 'ПР', 0)?.planned).toBe(true)
    expect(block(map, '2026-11', 'ПР', 1)?.planned).toBe(false)
  })

  it('GC-13: окно 24.11 при людной неделе 7 дней помечено людным, 10.11 нет', () => {
    const map = layouts([practice])
    expect(block(map, '2026-11', 'ПР', 0)?.crowded).toBe(false)
    expect(block(map, '2026-11', 'ПР', 1)?.crowded).toBe(true)
  })

  it('длина людной недели берётся из параметра', () => {
    const map = layouts([practice], 3)
    expect(block(map, '2026-11', 'ПР', 1)?.crowded).toBe(false)
  })

  it('одно окно: без акцента и без пометки людного', () => {
    const map = layouts([
      {
        ...practice,
        start: d('11-24'),
        end: d('11-24'),
        windows: [{ startDate: d('11-24'), endDate: d('11-24'), planned: true }],
      },
    ])
    expect(block(map, '2026-11', 'ПР', 0)).toMatchObject({ planned: false, crowded: false })
  })

  it('окно, перешедшее через границу месяца, делится на два куска одного блока', () => {
    const map = layouts([
      {
        ...practice,
        windows: [{ startDate: d('11-28'), endDate: d('12-03'), planned: true }],
        start: d('11-28'),
        end: d('12-03'),
      },
    ])
    expect(block(map, '2026-11', 'ПР', 0)).toMatchObject({ startDay: 28, endDay: 30, continuesRight: true })
    expect(block(map, '2026-12', 'ПР', 0)).toMatchObject({ startDay: 1, endDay: 3, continuesLeft: true })
  })
})
