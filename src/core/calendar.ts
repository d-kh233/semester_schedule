// Календарь семестра: месяцы, числа 1–31 и дни недели строятся по датам семестра

import {
  compareIsoDates,
  daysInMonth,
  formatIsoDate,
  isValidIsoDate,
  parseIsoDate,
  weekday,
  type IsoDate,
} from './dates'

export const MAX_SEMESTER_MONTHS = 24

export type SemesterError = 'invalid-date' | 'end-before-start' | 'too-long'

// normal: обычный день семестра; nonexistent: такого числа нет в месяце (31 ноября);
// outside: число есть, но оно вне семестра (крайние месяцы)
export type DayStatus = 'normal' | 'nonexistent' | 'outside'

export interface CalendarDay {
  day: number
  date: IsoDate | null
  weekday: number | null
  status: DayStatus
}

export interface CalendarMonth {
  key: string
  year: number
  month: number
  days: CalendarDay[]
}

export type DayTiming = 'past' | 'today' | 'future'

function monthsBetween(start: IsoDate, end: IsoDate): number {
  const s = parseIsoDate(start)
  const e = parseIsoDate(end)
  return (e.year - s.year) * 12 + (e.month - s.month) + 1
}

export function validateSemester(start: string, end: string): SemesterError | null {
  if (!isValidIsoDate(start) || !isValidIsoDate(end)) return 'invalid-date'
  if (compareIsoDates(end, start) < 0) return 'end-before-start'
  if (monthsBetween(start, end) > MAX_SEMESTER_MONTHS) return 'too-long'
  return null
}

function buildMonth(year: number, month: number, start: IsoDate, end: IsoDate): CalendarMonth {
  const length = daysInMonth(year, month)
  const days: CalendarDay[] = []
  for (let day = 1; day <= 31; day++) {
    if (day > length) {
      days.push({ day, date: null, weekday: null, status: 'nonexistent' })
      continue
    }
    const date = formatIsoDate(year, month, day)
    const inside = compareIsoDates(date, start) >= 0 && compareIsoDates(date, end) <= 0
    days.push({ day, date, weekday: weekday(date), status: inside ? 'normal' : 'outside' })
  }
  return { key: `${year}-${String(month).padStart(2, '0')}`, year, month, days }
}

export function buildCalendar(start: IsoDate, end: IsoDate): CalendarMonth[] {
  const error = validateSemester(start, end)
  if (error) throw new Error(`Неверный семестр: ${error}`)
  const first = parseIsoDate(start)
  const count = monthsBetween(start, end)
  const months: CalendarMonth[] = []
  for (let i = 0; i < count; i++) {
    const index = first.month - 1 + i
    months.push(buildMonth(first.year + Math.floor(index / 12), (index % 12) + 1, start, end))
  }
  return months
}

export function getDayTiming(date: IsoDate, today: IsoDate): DayTiming {
  const order = compareIsoDates(date, today)
  if (order < 0) return 'past'
  return order === 0 ? 'today' : 'future'
}
