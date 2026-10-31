import { describe, expect, it } from 'vitest'
import {
  buildCalendar,
  getDayTiming,
  validateSemester,
  firstMondayOnOrAfter,
  weekNumber,
  weekOneMondayFor,
} from '../../src/core/calendar'

// «Сегодня» во всех тестах задаётся явно
const TODAY = '2026-10-31'

describe('validateSemester', () => {
  it('нормальный семестр', () => {
    expect(validateSemester('2026-09-01', '2027-01-31')).toBeNull()
  })

  it('неверная дата', () => {
    expect(validateSemester('2026-09-31', '2027-01-31')).toBe('invalid-date')
    expect(validateSemester('2026-09-01', '')).toBe('invalid-date')
  })

  it('конец раньше начала', () => {
    expect(validateSemester('2027-01-31', '2026-09-01')).toBe('end-before-start')
  })

  it('слишком длинный период (больше 24 месяцев)', () => {
    expect(validateSemester('2026-01-01', '2028-02-01')).toBe('too-long')
    expect(validateSemester('2026-01-01', '2027-12-31')).toBeNull()
  })

  it('семестр в один день допустим', () => {
    expect(validateSemester('2026-09-01', '2026-09-01')).toBeNull()
  })
})

describe('buildCalendar', () => {
  const months = buildCalendar('2026-09-01', '2027-01-31')

  it('месяцы от сентября до января, по порядку', () => {
    expect(months.map((m) => m.key)).toEqual([
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ])
  })

  it('в каждом месяце 31 ячейка', () => {
    for (const m of months) expect(m.days).toHaveLength(31)
  })

  it('GC-7: 31-е число в ноябре (30 дней) не существует', () => {
    const november = months.find((m) => m.key === '2026-11')
    const day31 = november?.days[30]
    expect(day31?.day).toBe(31)
    expect(day31?.date).toBeNull()
    expect(day31?.weekday).toBeNull()
    expect(day31?.status).toBe('nonexistent')
  })

  it('31-е число в октябре существует и это суббота', () => {
    const october = months.find((m) => m.key === '2026-10')
    const day31 = october?.days[30]
    expect(day31?.date).toBe('2026-10-31')
    expect(day31?.weekday).toBe(5)
    expect(day31?.status).toBe('normal')
  })

  it('дни недели подставляются сами (01.09.2026 вторник)', () => {
    const september = months[0]
    expect(september?.days[0]?.date).toBe('2026-09-01')
    expect(september?.days[0]?.weekday).toBe(1)
  })

  it('сентябрь: 30-го число есть, 31-го нет', () => {
    const september = months[0]
    expect(september?.days[29]?.status).toBe('normal')
    expect(september?.days[30]?.status).toBe('nonexistent')
  })

  it('февраль: 28 или 29 дней', () => {
    const feb2026 = buildCalendar('2026-02-01', '2026-02-28')[0]
    expect(feb2026?.days.filter((d) => d.date !== null)).toHaveLength(28)
    const feb2028 = buildCalendar('2028-02-01', '2028-02-29')[0]
    expect(feb2028?.days.filter((d) => d.date !== null)).toHaveLength(29)
  })

  it('дни вне семестра в крайних месяцах помечены «outside»', () => {
    const partial = buildCalendar('2026-09-10', '2026-10-05')
    const september = partial[0]
    expect(september?.days[8]?.status).toBe('outside') // 9 сентября
    expect(september?.days[9]?.status).toBe('normal') // 10 сентября
    const october = partial[1]
    expect(october?.days[4]?.status).toBe('normal') // 5 октября
    expect(october?.days[5]?.status).toBe('outside') // 6 октября
  })

  it('у дней вне семестра дата и день недели всё равно известны', () => {
    const partial = buildCalendar('2026-09-10', '2026-10-05')
    expect(partial[0]?.days[8]?.date).toBe('2026-09-09')
    expect(partial[0]?.days[8]?.weekday).toBe(2)
  })

  it('переход через год', () => {
    const jan = months[4]
    expect(jan?.year).toBe(2027)
    expect(jan?.month).toBe(1)
  })
})

describe('getDayTiming', () => {
  it('прошедший, сегодняшний и будущий день', () => {
    expect(getDayTiming('2026-10-30', TODAY)).toBe('past')
    expect(getDayTiming('2026-10-31', TODAY)).toBe('today')
    expect(getDayTiming('2026-11-01', TODAY)).toBe('future')
  })

  it('через границу года', () => {
    expect(getDayTiming('2026-12-31', '2027-01-01')).toBe('past')
  })
})

describe('weekNumber (неделя начинается с первого понедельника семестра)', () => {
  const START = '2026-09-01' // вторник

  it('первый понедельник семестра — неделя 1', () => {
    expect(weekNumber('2026-09-07', firstMondayOnOrAfter(START))).toBe(1)
  })

  it('следующие понедельники: 2, 3, ...', () => {
    expect(weekNumber('2026-09-14', firstMondayOnOrAfter(START))).toBe(2)
    expect(weekNumber('2026-10-26', firstMondayOnOrAfter(START))).toBe(8)
  })

  it('все дни недели относятся к одной неделе (вт-вс после понедельника)', () => {
    expect(weekNumber('2026-09-13', firstMondayOnOrAfter(START))).toBe(1)
    expect(weekNumber('2026-09-14', firstMondayOnOrAfter(START))).toBe(2)
  })

  it('дни до первого понедельника без номера', () => {
    expect(weekNumber('2026-09-01', firstMondayOnOrAfter(START))).toBeNull()
    expect(weekNumber('2026-09-06', firstMondayOnOrAfter(START))).toBeNull()
  })

  it('если семестр начался в понедельник, он сам неделя 1', () => {
    expect(weekNumber('2026-09-07', firstMondayOnOrAfter('2026-09-07'))).toBe(1)
    expect(weekNumber('2026-09-14', firstMondayOnOrAfter('2026-09-07'))).toBe(2)
  })

  it('через границу года', () => {
    expect(weekNumber('2027-01-04', firstMondayOnOrAfter(START))).toBe(18)
  })
})

describe('firstMondayOnOrAfter', () => {
  it('понедельник остаётся собой', () => {
    expect(firstMondayOnOrAfter('2026-09-07')).toBe('2026-09-07')
  })

  it('остальные дни — следующий понедельник', () => {
    expect(firstMondayOnOrAfter('2026-09-01')).toBe('2026-09-07')
    expect(firstMondayOnOrAfter('2026-09-06')).toBe('2026-09-07')
    expect(firstMondayOnOrAfter('2026-12-30')).toBe('2027-01-04')
  })
})

describe('weekOneMondayFor (поставить номер на другую неделю)', () => {
  it('единица на другом понедельнике: счёт начинается с него', () => {
    const weekOne = weekOneMondayFor('2026-09-14', 1)
    expect(weekOne).toBe('2026-09-14')
    expect(weekNumber('2026-09-07', weekOne)).toBeNull()
    expect(weekNumber('2026-09-14', weekOne)).toBe(1)
    expect(weekNumber('2026-09-21', weekOne)).toBe(2)
  })

  it('число больше 1: недели до него получают номера, меняется вся таблица', () => {
    const weekOne = weekOneMondayFor('2026-09-28', 10)
    expect(weekOne).toBe('2026-07-27')
    expect(weekNumber('2026-09-28', weekOne)).toBe(10)
    expect(weekNumber('2026-09-14', weekOne)).toBe(8)
    expect(weekNumber('2026-09-07', weekOne)).toBe(7)
  })

  it('тот же номер на том же месте ничего не меняет', () => {
    const weekOne = weekOneMondayFor('2026-09-07', 1)
    expect(weekNumber('2026-10-26', weekOne)).toBe(8)
  })

  it('не понедельник или неверный номер — ошибка', () => {
    expect(() => weekOneMondayFor('2026-09-08', 1)).toThrow()
    expect(() => weekOneMondayFor('2026-09-07', 0)).toThrow()
    expect(() => weekOneMondayFor('2026-09-07', 1.5)).toThrow()
    expect(() => weekOneMondayFor('2026-09-07', 100)).toThrow()
  })
})
