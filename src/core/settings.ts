// Настройки, нужные сетке. Остальные настройки (типы, уровни важности) добавятся на шаге 6.

import { validateSemester } from './calendar'
import { isHexColor, type WeekGradient } from './colors'
import { isValidIsoDate, type IsoDate } from './dates'

export type NonexistentDaysMode = 'gray' | 'hidden'

export interface Settings {
  semesterStart: IsoDate
  semesterEnd: IsoDate
  weekGradient: WeekGradient
  // Цвета месяцев: индекс 0 — январь, 11 — декабрь
  monthColors: string[]
  mutePastDays: boolean
  nonexistentDays: NonexistentDaysMode
}

export const defaultSettings: Settings = {
  semesterStart: '2026-09-01',
  semesterEnd: '2027-01-31',
  weekGradient: { light: '#f6eefb', dark: '#c4a3dc' },
  monthColors: [
    '#bcd7ee', // январь
    '#c9c4ee', // февраль
    '#d8c0e8', // март
    '#f0c1d9', // апрель
    '#f5c6c0', // май
    '#f8d3b0', // июнь
    '#f6e3a4', // июль
    '#d6e8a6', // август
    '#b9e0b4', // сентябрь
    '#f3cfa0', // октябрь
    '#d9b8a0', // ноябрь
    '#a9cbe8', // декабрь
  ],
  mutePastDays: true,
  nonexistentDays: 'gray',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readGradient(value: unknown): WeekGradient {
  const fallback = defaultSettings.weekGradient
  if (!isRecord(value)) return fallback
  const { light, dark } = value
  return {
    light: typeof light === 'string' && isHexColor(light) ? light : fallback.light,
    dark: typeof dark === 'string' && isHexColor(dark) ? dark : fallback.dark,
  }
}

function readMonthColors(value: unknown): string[] {
  if (!Array.isArray(value) || value.length !== 12) return defaultSettings.monthColors
  return value.map((color, i) =>
    typeof color === 'string' && isHexColor(color) ? color : (defaultSettings.monthColors[i] ?? '#dddddd'),
  )
}

// Читает сохранённые настройки. Любая порча данных даёт значения по умолчанию, но не ошибку.
export function parseStoredSettings(json: string | null): Settings {
  if (!json) return defaultSettings
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return defaultSettings
  }
  if (!isRecord(data)) return defaultSettings

  // Каждая верная дата сохраняется, неверная заменяется по умолчанию;
  // если вместе они не образуют семестр, берётся пара по умолчанию
  const storedStart = typeof data.semesterStart === 'string' ? data.semesterStart : ''
  const storedEnd = typeof data.semesterEnd === 'string' ? data.semesterEnd : ''
  const start = isValidIsoDate(storedStart) ? storedStart : defaultSettings.semesterStart
  const end = isValidIsoDate(storedEnd) ? storedEnd : defaultSettings.semesterEnd
  const semesterOk = validateSemester(start, end) === null

  return {
    semesterStart: semesterOk ? start : defaultSettings.semesterStart,
    semesterEnd: semesterOk ? end : defaultSettings.semesterEnd,
    weekGradient: readGradient(data.weekGradient),
    monthColors: readMonthColors(data.monthColors),
    mutePastDays:
      typeof data.mutePastDays === 'boolean' ? data.mutePastDays : defaultSettings.mutePastDays,
    nonexistentDays:
      data.nonexistentDays === 'gray' || data.nonexistentDays === 'hidden'
        ? data.nonexistentDays
        : defaultSettings.nonexistentDays,
  }
}
