// Общие настройки вида (палитра и поведение клеток). Всё, что относится к конкретному
// расписанию (даты, недели, ширины), лежит в модели расписания, см. model.ts.

import { validateSemester } from './calendar'
import { isHexColor, type WeekGradient } from './colors'
import { isValidIsoDate, type IsoDate } from './dates'

export type NonexistentDaysMode = 'gray' | 'hidden'

export interface Settings {
  weekGradient: WeekGradient
  // Цвета месяцев: индекс 0 — январь, 11 — декабрь
  monthColors: string[]
  mutePastDays: boolean
  nonexistentDays: NonexistentDaysMode
}

export const defaultSemesterDates = { start: '2026-09-01', end: '2027-01-31' } as const

export const defaultSettings: Settings = {
  weekGradient: { light: '#f8dfc8', dark: '#4a1824' },
  monthColors: [
    '#9db4cf', // январь
    '#a6a0cc', // февраль
    '#b98fb5', // март
    '#d4909f', // апрель
    '#d98f7a', // май
    '#e0a45e', // июнь
    '#d8b84e', // июль
    '#a9bf63', // август
    '#d9b27c', // сентябрь
    '#c99a78', // октябрь
    '#a85a64', // ноябрь
    '#7d3040', // декабрь
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
    typeof color === 'string' && isHexColor(color)
      ? color
      : (defaultSettings.monthColors[i] ?? '#dddddd'),
  )
}

// Читает настройки из записи хранилища. Любая порча даёт значения по умолчанию, но не ошибку.
export function parseSettings(data: unknown): Settings {
  if (!isRecord(data)) return defaultSettings
  return {
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

export interface LegacySettings {
  settings: Settings
  semesterStart: IsoDate
  semesterEnd: IsoDate
}

// Настройки шага 2 лежали в localStorage вместе с датами семестра.
// Читаются один раз при переезде в IndexedDB.
export function parseLegacySettings(json: string | null): LegacySettings {
  const empty: LegacySettings = {
    settings: defaultSettings,
    semesterStart: defaultSemesterDates.start,
    semesterEnd: defaultSemesterDates.end,
  }
  if (!json) return empty
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return empty
  }
  if (!isRecord(data)) return empty

  // Каждая верная дата сохраняется, неверная заменяется по умолчанию;
  // если вместе они не образуют семестр, берётся пара по умолчанию
  const storedStart = typeof data.semesterStart === 'string' ? data.semesterStart : ''
  const storedEnd = typeof data.semesterEnd === 'string' ? data.semesterEnd : ''
  const start = isValidIsoDate(storedStart) ? storedStart : defaultSemesterDates.start
  const end = isValidIsoDate(storedEnd) ? storedEnd : defaultSemesterDates.end
  const semesterOk = validateSemester(start, end) === null

  return {
    settings: parseSettings(data),
    semesterStart: semesterOk ? start : defaultSemesterDates.start,
    semesterEnd: semesterOk ? end : defaultSemesterDates.end,
  }
}
