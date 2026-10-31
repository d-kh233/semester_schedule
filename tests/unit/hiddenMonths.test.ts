import { describe, expect, it } from 'vitest'
import { buildCalendar } from '../../src/core/calendar'
import { contrastText, weekdayColor, weekdayTextColor } from '../../src/core/colors'
import {
  countHiddenMonths,
  parseHiddenMonths,
  toggleHiddenMonth,
  visibleMonths,
} from '../../src/core/hiddenMonths'
import { createSemester, parseSemester } from '../../src/core/model'

const months = buildCalendar('2026-09-01', '2027-01-31')

describe('visibleMonths', () => {
  it('ничего не скрыто: все месяцы на месте', () => {
    expect(visibleMonths(months, []).map((m) => m.key)).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ])
  })

  it('скрытые месяцы убираются, порядок остальных сохраняется', () => {
    expect(visibleMonths(months, ['2026-09', '2026-11']).map((m) => m.key)).toEqual([
      '2026-10',
      '2026-12',
      '2027-01',
    ])
  })

  it('скрытый месяц вне семестра ни на что не влияет', () => {
    expect(visibleMonths(months, ['2030-05'])).toHaveLength(5)
  })
})

describe('countHiddenMonths', () => {
  it('считает только скрытые месяцы, которые есть в календаре', () => {
    expect(countHiddenMonths(months, ['2026-09', '2030-05'])).toBe(1)
    expect(countHiddenMonths(months, [])).toBe(0)
  })
})

describe('toggleHiddenMonth', () => {
  it('добавляет месяц и убирает при повторном вызове', () => {
    const hidden = toggleHiddenMonth([], '2026-10')
    expect(hidden).toEqual(['2026-10'])
    expect(toggleHiddenMonth(hidden, '2026-10')).toEqual([])
  })

  it('держит список по порядку и не меняет исходный', () => {
    const before = ['2026-12']
    expect(toggleHiddenMonth(before, '2026-09')).toEqual(['2026-09', '2026-12'])
    expect(before).toEqual(['2026-12'])
  })
})

describe('parseHiddenMonths', () => {
  it('не список даёт пустой список', () => {
    expect(parseHiddenMonths(undefined)).toEqual([])
    expect(parseHiddenMonths('2026-09')).toEqual([])
  })

  it('оставляет только верные ключи месяцев без повторов', () => {
    expect(parseHiddenMonths(['2026-10', 5, '2026-13', 'abc', '2026-10', '2026-09'])).toEqual([
      '2026-09',
      '2026-10',
    ])
  })
})

describe('поле hiddenMonths у расписания', () => {
  it('новое расписание ничего не скрывает', () => {
    const s = createSemester(
      { id: 'a', name: 'Тест', startDate: '2026-09-01', endDate: '2027-01-31' },
      '2026-10-31T00:00:00Z',
    )
    expect(s.hiddenMonths).toEqual([])
  })

  it('старая запись без поля читается как «ничего не скрыто»', () => {
    const s = parseSemester(
      { id: 'a', name: 'Старое', startDate: '2026-09-01', endDate: '2027-01-31' },
      '2026-10-31T00:00:00Z',
    )
    expect(s?.hiddenMonths).toEqual([])
  })

  it('сохранённые скрытые месяцы читаются обратно', () => {
    const s = parseSemester(
      {
        id: 'a',
        startDate: '2026-09-01',
        endDate: '2027-01-31',
        hiddenMonths: ['2026-09', 'мусор'],
      },
      '2026-10-31T00:00:00Z',
    )
    expect(s?.hiddenMonths).toEqual(['2026-09'])
  })
})

describe('цвет текста в строке дней недели', () => {
  const gradient = { light: '#fbe5d6', dark: '#7a1020' }

  it('на тёмном дне текст белый, на светлом тёмный', () => {
    expect(weekdayTextColor(0, gradient)).toBe('#ffffff')
    expect(weekdayTextColor(2, gradient)).toBe('#1f1f1f')
  })

  it('градиент из тёмных цветов: текст белый во все дни', () => {
    const dim = { light: '#222222', dark: '#000000' }
    for (let d = 0; d < 7; d += 1) expect(weekdayTextColor(d, dim)).toBe('#ffffff')
  })

  it('градиент из светлых цветов: текст тёмный во все дни', () => {
    const pale = { light: '#ffffff', dark: '#dddddd' }
    for (let d = 0; d < 7; d += 1) expect(weekdayTextColor(d, pale)).toBe('#1f1f1f')
  })

  it('текст берётся по цвету, который реально нарисован в этот день', () => {
    for (let d = 0; d < 7; d += 1) {
      expect(weekdayTextColor(d, gradient)).toBe(contrastText(weekdayColor(d, gradient)))
    }
  })
})
