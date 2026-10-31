// Даты как строки YYYY-MM-DD, без объекта Date и часовых поясов.
// Счёт ведётся по номеру дня (дней от 01.01.1970), поэтому сдвигов из-за времени не бывает.

export type IsoDate = string

export interface DateParts {
  year: number
  month: number
  day: number
}

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function safeParts(value: string): DateParts | null {
  const match = ISO_PATTERN.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

export function isValidIsoDate(value: string): boolean {
  return safeParts(value) !== null
}

export function parseIsoDate(value: IsoDate): DateParts {
  const parts = safeParts(value)
  if (!parts) throw new Error(`Неверная дата: ${value}`)
  return parts
}

export function formatIsoDate(year: number, month: number, day: number): IsoDate {
  const y = String(year).padStart(4, '0')
  const m = String(month).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Номер дня от 01.01.1970 (алгоритм «days from civil»)
function toDayNumber(date: IsoDate): number {
  const { year, month, day } = parseIsoDate(date)
  const y = month <= 2 ? year - 1 : year
  const era = Math.floor(y / 400)
  const yearOfEra = y - era * 400
  const shiftedMonth = month + (month > 2 ? -3 : 9)
  const dayOfYear = Math.floor((153 * shiftedMonth + 2) / 5) + day - 1
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}

function fromDayNumber(n: number): IsoDate {
  const z = n + 719468
  const era = Math.floor(z / 146097)
  const dayOfEra = z - era * 146097
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  )
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100))
  const shiftedMonth = Math.floor((5 * dayOfYear + 2) / 153)
  const day = dayOfYear - Math.floor((153 * shiftedMonth + 2) / 5) + 1
  const month = shiftedMonth < 10 ? shiftedMonth + 3 : shiftedMonth - 9
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0)
  return formatIsoDate(year, month, day)
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromDayNumber(toDayNumber(date) + days)
}

// Сколько дней от a до b (положительное, если b позже)
export function diffDays(a: IsoDate, b: IsoDate): number {
  return toDayNumber(b) - toDayNumber(a)
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return diffDays(b, a)
}

// 0 = понедельник ... 6 = воскресенье. 01.01.1970 был четвергом.
export function weekday(date: IsoDate): number {
  const n = toDayNumber(date)
  return (((n + 3) % 7) + 7) % 7
}

// Для показа пользователю: 21.10.2026
export function formatDateRu(date: IsoDate): string {
  const { year, month, day } = parseIsoDate(date)
  return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`
}
