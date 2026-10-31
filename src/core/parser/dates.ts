// Даты в строке ввода: год из семестра, дни недели

import {
  addDays,
  compareIsoDates,
  daysInMonth,
  formatIsoDate,
  parseIsoDate,
  weekday,
  type IsoDate,
} from '../dates'

function existsIn(year: number, month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

// Дата без года. Берётся год, при котором дата попадает в семестр; если не попадает ни в один,
// то ближайший год после начала семестра. Несуществующая дата даёт null.
export function inferDate(
  day: number,
  month: number,
  semesterStart: IsoDate,
  semesterEnd: IsoDate,
): IsoDate | null {
  const first = parseIsoDate(semesterStart)
  const last = parseIsoDate(semesterEnd)
  for (let year = first.year; year <= last.year; year++) {
    if (!existsIn(year, month, day)) continue
    const date = formatIsoDate(year, month, day)
    if (compareIsoDates(date, semesterStart) >= 0 && compareIsoDates(date, semesterEnd) <= 0) {
      return date
    }
  }
  const preferred = month >= first.month ? first.year : first.year + 1
  return existsIn(preferred, month, day) ? formatIsoDate(preferred, month, day) : null
}

// Ближайшая дата с этим днём недели строго после сегодняшнего дня (0 = понедельник)
export function resolveWeekday(weekdayIndex: number, today: IsoDate): IsoDate {
  const delta = (weekdayIndex - weekday(today) + 7) % 7 || 7
  return addDays(today, delta)
}
