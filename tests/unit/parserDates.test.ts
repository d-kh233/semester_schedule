import { describe, expect, it } from 'vitest'
import { inferDate, resolveWeekday } from '../../src/core/parser/dates'
import { tokenize } from '../../src/core/parser/tokenize'

describe('inferDate (год из семестра)', () => {
  const autumn = { start: '2026-09-01', end: '2027-01-31' }
  const spring = { start: '2027-02-01', end: '2027-06-30' }

  it('дата внутри семестра берёт подходящий год', () => {
    expect(inferDate(21, 10, autumn.start, autumn.end)).toBe('2026-10-21')
    expect(inferDate(21, 1, autumn.start, autumn.end)).toBe('2027-01-21')
    expect(inferDate(15, 3, spring.start, spring.end)).toBe('2027-03-15')
  })

  it('дата вне семестра: ближайший год после начала семестра', () => {
    expect(inferDate(5, 5, autumn.start, autumn.end)).toBe('2027-05-05')
    expect(inferDate(5, 10, spring.start, spring.end)).toBe('2027-10-05')
  })

  it('несуществующая дата — null', () => {
    expect(inferDate(31, 11, autumn.start, autumn.end)).toBeNull()
    expect(inferDate(29, 2, autumn.start, autumn.end)).toBeNull()
    expect(inferDate(32, 10, autumn.start, autumn.end)).toBeNull()
    expect(inferDate(10, 0, autumn.start, autumn.end)).toBeNull()
  })

  it('29 февраля находится в високосном году семестра', () => {
    expect(inferDate(29, 2, '2027-09-01', '2028-06-30')).toBe('2028-02-29')
  })
})

describe('resolveWeekday (строго после сегодняшнего дня)', () => {
  it('суббота 31.10.2026: пятница — 06.11, воскресенье — 01.11', () => {
    expect(resolveWeekday(4, '2026-10-31')).toBe('2026-11-06')
    expect(resolveWeekday(6, '2026-10-31')).toBe('2026-11-01')
  })

  it('тот же день недели — через неделю', () => {
    expect(resolveWeekday(5, '2026-10-31')).toBe('2026-11-07')
  })
})

describe('tokenize', () => {
  const kinds = (text: string) => tokenize(text).map((t) => t.kind)

  it('даты, время, слова', () => {
    expect(kinds('1 матан кр 21.10 17:00')).toEqual(['word', 'word', 'word', 'date', 'time'])
  })

  it('период без пробелов и с пробелами', () => {
    expect(kinds('13.10–15.11')).toEqual(['date', 'dash', 'date'])
    expect(kinds('13.10 - 15.11')).toEqual(['date', 'dash', 'date'])
    expect(kinds('13.10 — 15.11')).toEqual(['date', 'dash', 'date'])
  })

  it('день и название месяца — одна дата', () => {
    expect(kinds('13 ноября')).toEqual(['date'])
    expect(kinds('13 Ноября')).toEqual(['date'])
  })

  it('запятая между датами', () => {
    expect(kinds('10.11, 24.11')).toEqual(['date', 'comma', 'date'])
  })

  it('«завтра» и «пт» — даты', () => {
    expect(kinds('завтра')).toEqual(['rel'])
    expect(kinds('пт')).toEqual(['weekday'])
  })

  it('дефис внутри слова — часть слова', () => {
    expect(kinds('физ-ра')).toEqual(['word'])
  })

  it('цифра перед словом, не месяцем, остаётся словом', () => {
    expect(kinds('2 матан')).toEqual(['word', 'word'])
  })
})
