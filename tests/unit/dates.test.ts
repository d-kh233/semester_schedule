import { describe, expect, it } from 'vitest'
import {
  addDays,
  compareIsoDates,
  daysInMonth,
  diffDays,
  formatDateRu,
  formatIsoDate,
  isLeapYear,
  isValidIsoDate,
  parseIsoDate,
  weekday,
} from '../../src/core/dates'

describe('isValidIsoDate', () => {
  it('принимает существующие даты', () => {
    expect(isValidIsoDate('2026-10-31')).toBe(true)
    expect(isValidIsoDate('2028-02-29')).toBe(true)
  })

  it('отвергает несуществующие даты', () => {
    expect(isValidIsoDate('2026-02-29')).toBe(false)
    expect(isValidIsoDate('2026-11-31')).toBe(false)
    expect(isValidIsoDate('2026-13-01')).toBe(false)
    expect(isValidIsoDate('2026-00-10')).toBe(false)
    expect(isValidIsoDate('2026-10-00')).toBe(false)
  })

  it('отвергает неверный формат', () => {
    expect(isValidIsoDate('2026-1-1')).toBe(false)
    expect(isValidIsoDate('31.10.2026')).toBe(false)
    expect(isValidIsoDate('2026-10-31T00:00:00')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
    expect(isValidIsoDate('abc')).toBe(false)
  })
})

describe('parseIsoDate и formatIsoDate', () => {
  it('разбирает дату на части', () => {
    expect(parseIsoDate('2026-10-31')).toEqual({ year: 2026, month: 10, day: 31 })
  })

  it('собирает дату с ведущими нулями', () => {
    expect(formatIsoDate(2026, 3, 5)).toBe('2026-03-05')
  })

  it('на неверной дате бросает ошибку', () => {
    expect(() => parseIsoDate('2026-02-30')).toThrow()
  })
})

describe('isLeapYear и daysInMonth', () => {
  it('високосные годы', () => {
    expect(isLeapYear(2028)).toBe(true)
    expect(isLeapYear(2000)).toBe(true)
    expect(isLeapYear(2100)).toBe(false)
    expect(isLeapYear(2026)).toBe(false)
  })

  it('число дней в месяце', () => {
    expect(daysInMonth(2026, 11)).toBe(30)
    expect(daysInMonth(2026, 10)).toBe(31)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
  })
})

describe('weekday (0 = понедельник, 6 = воскресенье)', () => {
  it('31.10.2026 суббота', () => {
    expect(weekday('2026-10-31')).toBe(5)
  })

  it('06.11.2026 пятница, 01.01.2027 пятница', () => {
    expect(weekday('2026-11-06')).toBe(4)
    expect(weekday('2027-01-01')).toBe(4)
  })

  it('01.11.2026 воскресенье, 02.11.2026 понедельник', () => {
    expect(weekday('2026-11-01')).toBe(6)
    expect(weekday('2026-11-02')).toBe(0)
  })

  it('до 1970 года тоже считает верно (01.01.1969 среда)', () => {
    expect(weekday('1969-01-01')).toBe(2)
  })
})

describe('addDays', () => {
  it('переход через границу месяца и года', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('февраль високосного года', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('ноль дней не меняет дату', () => {
    expect(addDays('2026-10-31', 0)).toBe('2026-10-31')
  })
})

describe('diffDays и compareIsoDates', () => {
  it('разница в днях', () => {
    expect(diffDays('2026-10-31', '2026-11-06')).toBe(6)
    expect(diffDays('2026-11-06', '2026-10-31')).toBe(-6)
    expect(diffDays('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('сравнение дат', () => {
    expect(compareIsoDates('2026-10-31', '2026-11-01')).toBeLessThan(0)
    expect(compareIsoDates('2027-01-01', '2026-12-31')).toBeGreaterThan(0)
    expect(compareIsoDates('2026-10-31', '2026-10-31')).toBe(0)
  })
})

describe('formatDateRu', () => {
  it('день.месяц.год с ведущими нулями', () => {
    expect(formatDateRu('2026-10-21')).toBe('21.10.2026')
    expect(formatDateRu('2027-01-05')).toBe('05.01.2027')
  })
})
