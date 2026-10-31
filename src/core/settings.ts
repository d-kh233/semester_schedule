// Общие настройки вида (палитра и поведение клеток). Всё, что относится к конкретному
// расписанию (даты, недели, ширины), лежит в модели расписания, см. model.ts.

import { validateBaseColors } from './autoPalette'
import { parseSavedPalettes, type SavedPalette } from './schedulePalette'
import { validateSemester } from './calendar'
import { isHexColor, type WeekGradient } from './colors'
import { isValidIsoDate, type IsoDate } from './dates'
import { DEFAULT_DIRECTION, type ImportanceDirection } from './importance'

export type NonexistentDaysMode = 'gray' | 'hidden'

// Как отмечается выполненное в сетке: приглушить или зачеркнуть (FR-24)
export type DoneStyle = 'mute' | 'strike'

export const MIN_CROWDED_DAYS = 1
export const MAX_CROWDED_DAYS = 31
export const DEFAULT_CROWDED_DAYS = 7

export function clampCrowdedDays(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CROWDED_DAYS
  return Math.min(MAX_CROWDED_DAYS, Math.max(MIN_CROWDED_DAYS, Math.round(value)))
}

export interface Settings {
  weekGradient: WeekGradient
  // Цвета месяцев: индекс 0 — январь, 11 — декабрь
  monthColors: string[]
  mutePastDays: boolean
  nonexistentDays: NonexistentDaysMode
  // Базовые цвета для автосборки палитры (3–7)
  paletteBases: string[]
  // Свой цвет сегодняшнего дня; null — подбирается по палитре
  todayColor: string | null
  // Сохранённые палитры для повторного использования (общие для всех расписаний)
  savedPalettes: SavedPalette[]
  // Сколько последних дней месяца считается людной неделей (BR-8)
  crowdedDays: number
  doneStyle: DoneStyle
  // Какая цифра важности главнее (GC-16)
  importanceDirection: ImportanceDirection
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
  paletteBases: ['#7d3040', '#e0a45e', '#9db4cf'],
  todayColor: null,
  savedPalettes: [],
  crowdedDays: DEFAULT_CROWDED_DAYS,
  doneStyle: 'mute',
  importanceDirection: DEFAULT_DIRECTION,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readGradient(value: unknown): WeekGradient {
  const fallback = defaultSettings.weekGradient
  if (!isRecord(value)) return fallback
  const { light, dark } = value
  const days = value.days
  const validDays =
    Array.isArray(days) && days.length === 7 && days.every((d) => typeof d === 'string' && isHexColor(d))
  return {
    light: typeof light === 'string' && isHexColor(light) ? light : fallback.light,
    dark: typeof dark === 'string' && isHexColor(dark) ? dark : fallback.dark,
    ...(validDays ? { days: days as string[] } : {}),
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

function readPaletteBases(value: unknown): string[] {
  if (!Array.isArray(value)) return defaultSettings.paletteBases
  const colors = value.filter((c): c is string => typeof c === 'string')
  const ok = colors.length === value.length && validateBaseColors(colors) === null
  return ok ? colors : defaultSettings.paletteBases
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
    paletteBases: readPaletteBases(data.paletteBases),
    todayColor:
      typeof data.todayColor === 'string' && isHexColor(data.todayColor) ? data.todayColor : null,
    savedPalettes: parseSavedPalettes(data.savedPalettes),
    crowdedDays:
      typeof data.crowdedDays === 'number'
        ? clampCrowdedDays(data.crowdedDays)
        : DEFAULT_CROWDED_DAYS,
    doneStyle: data.doneStyle === 'strike' ? 'strike' : 'mute',
    importanceDirection: data.importanceDirection === 'max' ? 'max' : DEFAULT_DIRECTION,
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
