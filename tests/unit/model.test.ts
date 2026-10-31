import { describe, expect, it } from 'vitest'
import {
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_MONTH_COLUMN_WIDTH,
  clampColumnWidth,
  createSemester,
  fitColumnWidth,
  parseSemester,
  pickActiveId,
  sortSemesters,
  validateScheduleName,
  type Semester,
} from '../../src/core/model'

const NOW = '2026-10-31T12:00:00.000Z'

function make(id: string, patch: Partial<Semester> = {}): Semester {
  return {
    ...createSemester({ id, name: id, startDate: '2026-09-01', endDate: '2027-01-31' }, NOW),
    ...patch,
  }
}

describe('createSemester', () => {
  it('заполняет значения по умолчанию', () => {
    const s = createSemester(
      { id: 'a', name: 'Весна', startDate: '2027-02-01', endDate: '2027-06-30' },
      NOW,
    )
    expect(s.name).toBe('Весна')
    expect(s.weekOneMonday).toBeNull()
    expect(s.columnWidths).toHaveLength(31)
    expect(s.columnWidths.every((w) => w === DEFAULT_COLUMN_WIDTH)).toBe(true)
    expect(s.monthColumnWidth).toBe(DEFAULT_MONTH_COLUMN_WIDTH)
    expect(s.isDemo).toBe(false)
    expect(s.archived).toBe(false)
    expect(s.createdAt).toBe(NOW)
    expect(s.updatedAt).toBe(NOW)
  })

  it('демо-расписание помечается', () => {
    const s = createSemester(
      { id: 'd', name: 'Демо', startDate: '2026-09-01', endDate: '2027-01-31', isDemo: true },
      NOW,
    )
    expect(s.isDemo).toBe(true)
  })
})

describe('parseSemester (чтение записи из хранилища)', () => {
  it('полная верная запись читается без изменений', () => {
    const original = make('a', {
      weekOneMonday: '2026-09-14',
      archived: true,
      columnWidths: Array<number>(31).fill(40),
    })
    expect(parseSemester(JSON.parse(JSON.stringify(original)), NOW)).toEqual(original)
  })

  it('не объект, нет id или неверный семестр — запись не читается (null)', () => {
    expect(parseSemester(null, NOW)).toBeNull()
    expect(parseSemester('x', NOW)).toBeNull()
    expect(
      parseSemester({ name: 'без id', startDate: '2026-09-01', endDate: '2027-01-31' }, NOW),
    ).toBeNull()
    expect(
      parseSemester({ id: 'a', startDate: '2026-09-31', endDate: '2027-01-31' }, NOW),
    ).toBeNull()
    expect(
      parseSemester({ id: 'a', startDate: '2027-02-01', endDate: '2026-09-01' }, NOW),
    ).toBeNull()
  })

  it('остальные поля при порче заменяются значениями по умолчанию', () => {
    const s = parseSemester(
      {
        id: 'a',
        startDate: '2026-09-01',
        endDate: '2027-01-31',
        name: 42,
        weekOneMonday: '2026-09-08', // вторник
        columnWidths: [1, 2, 3],
        monthColumnWidth: 'широко',
        isDemo: 'да',
        archived: 1,
      },
      NOW,
    )
    expect(s).not.toBeNull()
    expect(s?.name).toBe('Без названия')
    expect(s?.weekOneMonday).toBeNull()
    expect(s?.columnWidths).toHaveLength(31)
    expect(s?.columnWidths[0]).toBe(DEFAULT_COLUMN_WIDTH)
    expect(s?.monthColumnWidth).toBe(DEFAULT_MONTH_COLUMN_WIDTH)
    expect(s?.isDemo).toBe(false)
    expect(s?.archived).toBe(false)
    expect(s?.createdAt).toBe(NOW)
  })

  it('ширины вне допустимых границ подрезаются', () => {
    const widths = Array<number>(31).fill(500)
    widths[0] = 1
    const s = parseSemester(
      { id: 'a', startDate: '2026-09-01', endDate: '2027-01-31', columnWidths: widths },
      NOW,
    )
    expect(s?.columnWidths[0]).toBe(16)
    expect(s?.columnWidths[1]).toBe(200)
  })
})

describe('clampColumnWidth и fitColumnWidth', () => {
  it('подрезает по границам и округляет', () => {
    expect(clampColumnWidth(5)).toBe(16)
    expect(clampColumnWidth(1000)).toBe(200)
    expect(clampColumnWidth(40.6)).toBe(41)
    expect(clampColumnWidth(Number.NaN)).toBe(DEFAULT_COLUMN_WIDTH)
  })

  it('вписывание в окно: 31 столбец делят остаток после колонки месяцев', () => {
    expect(fitColumnWidth(1110, 110)).toBe(32)
    expect(fitColumnWidth(1700, 110)).toBe(51)
  })

  it('слишком узкое окно: не уже минимума', () => {
    expect(fitColumnWidth(300, 110)).toBe(16)
  })
})

describe('validateScheduleName', () => {
  it('нормальное название', () => {
    expect(validateScheduleName('Весна 2027')).toBeNull()
  })

  it('пустое или из пробелов', () => {
    expect(validateScheduleName('')).toBe('empty')
    expect(validateScheduleName('   ')).toBe('empty')
  })

  it('длиннее 60 символов', () => {
    expect(validateScheduleName('а'.repeat(61))).toBe('too-long')
    expect(validateScheduleName('а'.repeat(60))).toBeNull()
  })
})

describe('pickActiveId', () => {
  it('выбранное расписание остаётся, если оно есть и не в архиве', () => {
    const list = [make('a'), make('b')]
    expect(pickActiveId(list, 'b')).toBe('b')
  })

  it('выбранное в архиве или не найдено: первое не архивное, не демо', () => {
    const list = [make('demo', { isDemo: true }), make('a', { archived: true }), make('b')]
    expect(pickActiveId(list, 'a')).toBe('b')
    expect(pickActiveId(list, 'нет такого')).toBe('b')
    expect(pickActiveId(list, null)).toBe('b')
  })

  it('если остались только демо: берётся демо', () => {
    const list = [make('demo', { isDemo: true }), make('a', { archived: true })]
    expect(pickActiveId(list, null)).toBe('demo')
  })

  it('всё в архиве или пусто: null', () => {
    expect(pickActiveId([make('a', { archived: true })], null)).toBeNull()
    expect(pickActiveId([], null)).toBeNull()
  })
})

describe('sortSemesters (стабильный порядок расписаний)', () => {
  it('по времени создания, раньше созданное выше', () => {
    const a = make('a', { createdAt: '2026-10-02T00:00:00.000Z' })
    const b = make('b', { createdAt: '2026-10-01T00:00:00.000Z' })
    expect(sortSemesters([a, b]).map((s) => s.id)).toEqual(['b', 'a'])
  })

  it('при одинаковом времени личное расписание выше демо', () => {
    const demo = make('1-demo', { isDemo: true })
    const mine = make('9-mine')
    expect(sortSemesters([demo, mine]).map((s) => s.id)).toEqual(['9-mine', '1-demo'])
  })

  it('исходный список не меняется', () => {
    const list = [make('b', { createdAt: '2026-10-02T00:00:00.000Z' }), make('a')]
    sortSemesters(list)
    expect(list.map((s) => s.id)).toEqual(['b', 'a'])
  })
})
