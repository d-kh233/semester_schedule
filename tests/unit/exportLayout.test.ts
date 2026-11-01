import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog, type ImportanceLevel } from '../../src/core/catalog'
import { buildDeadlineList, buildExportCalendar } from '../../src/core/exportLayout'
import { createEvent, type EventRecord } from '../../src/core/events'
import { createSemester, type Semester } from '../../src/core/model'
import { resolvePalette } from '../../src/core/schedulePalette'
import { weekdayColor } from '../../src/core/colors'
import { defaultSettings } from '../../src/core/settings'

// Семестр 09.2026–01.2027, типы и уровни по умолчанию. Цвета уровней уже «раскрашены» расписанием.
let n = 0
const { types, levels } = buildDefaultCatalog(() => `id-${++n}`)
const paintedLevels: ImportanceLevel[] = levels.map((l, i) => ({ ...l, color: `#00000${i + 1}` }))
const kr = types.find((t) => t.name === 'КР')!
const hackathon = types.find((t) => t.name === 'Хакатон')!

const semester: Semester = createSemester(
  { id: 'sem', name: 'Осень', startDate: '2026-09-01', endDate: '2027-01-31' },
  '2026-10-31T00:00:00.000Z',
)

function event(overrides: Partial<EventRecord>): EventRecord {
  return {
    ...createEvent(
      {
        title: 'Матан КР',
        typeId: kr.id,
        subjectId: null,
        startDate: '2026-10-21',
        endDate: '2026-10-21',
        time: null,
        importance: null,
        note: '',
        done: false,
      },
      { id: `e-${++n}`, semesterId: semester.id },
      '2026-10-01T00:00:00.000Z',
    ),
    ...overrides,
  }
}

const palette = resolvePalette(null, defaultSettings, levels)

function build(events: EventRecord[]) {
  return buildExportCalendar({
    semester,
    events,
    types,
    levels: paintedLevels,
    weekGradient: palette.weekGradient,
    monthColors: palette.monthColors,
  })
}

describe('buildExportCalendar: строки по дням', () => {
  it('ставит каждый дедлайн дня отдельной строкой, важнее — выше', () => {
    const low = event({ title: 'Тест', typeId: types.find((t) => t.name === 'Тест')!.id, importance: 3 })
    const high = event({ title: 'КР 1', importance: 1 })
    const october = build([low, high]).months.find((m) => m.month === 10)!
    const rows = october.rows.filter((r) => r.kind === 'deadline')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.cells[20]?.text).toBe('КР 1')
    expect(rows[1]?.cells[20]?.text).toBe('Тест')
  })

  it('цвет клетки — цвет важности расписания; без важности и цвета типа — null', () => {
    const withLevel = event({ importance: 2 })
    const noImportance = event({ typeId: null, importance: null })
    const october = build([withLevel, noImportance]).months.find((m) => m.month === 10)!
    const deadlines = october.rows.filter((r) => r.kind === 'deadline')
    expect(deadlines[0]?.cells[20]?.color).toBe('#000002')
    expect(deadlines[1]?.cells[20]?.color).toBeNull()
  })

  it('фоновый тип (хакатон) идёт после дедлайнов и занимает весь свой период', () => {
    const hack = event({
      title: 'Хакатон',
      typeId: hackathon.id,
      startDate: '2026-11-03',
      endDate: '2026-11-05',
    })
    const deadline = event({ startDate: '2026-11-10', endDate: '2026-11-10' })
    const november = build([hack, deadline]).months.find((m) => m.month === 11)!
    expect(november.rows.map((r) => r.kind)).toEqual(['deadline', 'background'])
    const bar = november.rows[1]?.cells[2]
    expect(bar?.text).toBe('Хакатон')
    expect(bar?.span).toBe(3)
  })

  it('пересекающиеся фоновые события идут в разных строках', () => {
    const a = event({ title: 'Хак A', typeId: hackathon.id, startDate: '2026-11-03', endDate: '2026-11-05' })
    const b = event({ title: 'Хак B', typeId: hackathon.id, startDate: '2026-11-04', endDate: '2026-11-06' })
    const november = build([a, b]).months.find((m) => m.month === 11)!
    expect(november.rows.filter((r) => r.kind === 'background')).toHaveLength(2)
  })

  it('месяц без событий всё равно имеет одну пустую строку', () => {
    const december = build([]).months.find((m) => m.month === 12)!
    expect(december.rows).toHaveLength(1)
    expect(december.rows[0]?.cells.every((c) => c === null)).toBe(true)
  })
})

describe('buildExportCalendar: цвета как на сайте', () => {
  it('месяц и дни недели берут цвета палитры расписания', () => {
    const october = build([]).months.find((m) => m.month === 10)!
    expect(october.monthColor).toBe(palette.monthColors[9])
    // 1 октября 2026 — четверг (индекс 3)
    expect(october.weekdayColors[0]).toBe(weekdayColor(3, palette.weekGradient))
    const september = build([]).months.find((m) => m.month === 9)!
    expect(september.weekdayColors[30]).toBeNull()
  })
})

describe('buildExportCalendar: дни и месяцы', () => {
  it('сентябрь имеет 30 дней, 31-го нет; 1 сентября 2026 — вторник', () => {
    const september = build([]).months.find((m) => m.month === 9)!
    expect(september.days[0]).toBe(1)
    expect(september.days[29]).toBe(30)
    expect(september.days[30]).toBeNull()
    expect(september.weekdays[0]).toBe(1)
  })

  it('месяцы идут по порядку от начала до конца семестра', () => {
    const keys = build([]).months.map((m) => m.key)
    expect(keys).toEqual(['2026-09', '2026-10', '2026-11', '2026-12', '2027-01'])
  })

  it('архивные и без даты события в календарь не попадают', () => {
    const archived = event({ archived: true, startDate: '2026-10-05', endDate: '2026-10-05' })
    const undated = event({ startDate: null, endDate: null })
    const october = build([archived, undated]).months.find((m) => m.month === 10)!
    expect(october.rows[0]?.cells.every((c) => c === null)).toBe(true)
  })
})

describe('buildDeadlineList: список дедлайнов под таблицей', () => {
  it('сортирует по дате, отмечает выполненные, не берёт архивные и без даты', () => {
    const later = event({ title: 'Тест 05.12', startDate: '2026-12-05', endDate: '2026-12-05', done: true })
    const earlier = event({ title: 'КР 21.10', startDate: '2026-10-21', endDate: '2026-10-21' })
    const archived = event({ title: 'Старое', archived: true })
    const undated = event({ title: 'Когда-нибудь', startDate: null, endDate: null })
    const list = buildDeadlineList([later, archived, undated, earlier], types)
    expect(list.map((item) => item.title)).toEqual(['КР 21.10', 'Тест 05.12'])
    expect(list[1]?.done).toBe(true)
    expect(list[0]?.date).toBe('2026-10-21')
  })
})
