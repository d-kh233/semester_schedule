// Людная неделя: последние N дней месяца (BR-8). Не хранится, а вычисляется.

import { daysInMonth, parseIsoDate, type IsoDate } from './dates'

export { DEFAULT_CROWDED_DAYS } from './settings'

export function isCrowdedDate(date: IsoDate, crowdedDays: number): boolean {
  if (crowdedDays <= 0) return false
  const { year, month, day } = parseIsoDate(date)
  return day > daysInMonth(year, month) - crowdedDays
}
