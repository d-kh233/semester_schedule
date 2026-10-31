// Палитра расписания: у каждого расписания свои цвета месяцев, дней недели и уровней важности.
// Пока своей палитры нет (null), работают общие цвета из настроек. Сохранённые палитры лежат
// в настройках и применяются к любому расписанию по кнопке.

import { sortLevels, type ImportanceLevel } from './catalog'
import { isHexColor, type WeekGradient } from './colors'

export interface SchedulePalette {
  weekGradient: WeekGradient
  // Индекс 0 — январь, 11 — декабрь
  monthColors: string[]
  // Цвет уровня с номером i + 1
  levelColors: string[]
  // Свой цвет сегодняшнего дня; null — подбирается по палитре (тёмный цвет дней недели)
  todayColor: string | null
  // Непрозрачность текста прошедших блоков: чем меньше, тем слабее виден текст
  pastTextOpacity: number
}

export interface SavedPalette {
  id: string
  name: string
  palette: SchedulePalette
}

export const MAX_PALETTE_NAME_LENGTH = 40
export const MIN_PAST_TEXT_OPACITY = 0.1
export const MAX_PAST_TEXT_OPACITY = 1
export const DEFAULT_PAST_TEXT_OPACITY = 0.35

export function clampPastOpacity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PAST_TEXT_OPACITY
  return Math.min(MAX_PAST_TEXT_OPACITY, Math.max(MIN_PAST_TEXT_OPACITY, Math.round(value * 100) / 100))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isHexList(value: unknown, length?: number): value is string[] {
  return (
    Array.isArray(value) &&
    (length === undefined || value.length === length) &&
    value.every((c) => typeof c === 'string' && isHexColor(c))
  )
}

function parseGradient(raw: unknown): WeekGradient | null {
  if (!isRecord(raw)) return null
  const { light, dark, days } = raw
  if (typeof light !== 'string' || !isHexColor(light)) return null
  if (typeof dark !== 'string' || !isHexColor(dark)) return null
  return isHexList(days, 7) ? { light, dark, days } : { light, dark }
}

// Читает палитру из записи; любая порча даёт null (расписание тогда берёт общие цвета)
export function parseSchedulePalette(raw: unknown): SchedulePalette | null {
  if (!isRecord(raw)) return null
  const weekGradient = parseGradient(raw.weekGradient)
  if (!weekGradient || !isHexList(raw.monthColors, 12) || !isHexList(raw.levelColors)) return null
  const today = raw.todayColor
  return {
    weekGradient,
    monthColors: raw.monthColors,
    levelColors: raw.levelColors,
    todayColor: typeof today === 'string' && isHexColor(today) ? today : null,
    pastTextOpacity:
      typeof raw.pastTextOpacity === 'number'
        ? clampPastOpacity(raw.pastTextOpacity)
        : DEFAULT_PAST_TEXT_OPACITY,
  }
}

// Палитра, которой пользуется расписание: своя, а если её нет, то общие цвета
export function resolvePalette(
  own: SchedulePalette | null,
  shared: { weekGradient: WeekGradient; monthColors: string[]; todayColor: string | null },
  levels: ImportanceLevel[],
): SchedulePalette {
  if (own) return own
  return {
    weekGradient: shared.weekGradient,
    monthColors: shared.monthColors,
    levelColors: sortLevels(levels).map((l) => l.color),
    todayColor: shared.todayColor,
    pastTextOpacity: DEFAULT_PAST_TEXT_OPACITY,
  }
}

// Вариант автосборки применяется к палитре расписания: цвет «сегодня» подбирается заново
// по новой палитре, прозрачность текста прошедших блоков остаётся прежней
export function withVariant(
  current: SchedulePalette,
  variant: Pick<SchedulePalette, 'weekGradient' | 'monthColors' | 'levelColors'>,
): SchedulePalette {
  return { ...variant, todayColor: null, pastTextOpacity: current.pastTextOpacity }
}

// Уровни с цветами палитры (по порядку номеров). Цвета привязаны к цифрам и не зависят от
// направления важности (GC-16): цифра 1 всегда самая яркая. Уровень без цвета остаётся как был.
export function paintLevels(levels: ImportanceLevel[], colors: readonly string[]): ImportanceLevel[] {
  const order = new Map(sortLevels(levels).map((l, i) => [l.id, i]))
  return levels.map((l) => ({ ...l, color: colors[order.get(l.id) ?? -1] ?? l.color }))
}

export type PaletteNameError = 'empty' | 'too-long' | 'duplicate'

export function validatePaletteName(name: string, saved: SavedPalette[]): PaletteNameError | null {
  const trimmed = name.trim()
  if (trimmed === '') return 'empty'
  if (trimmed.length > MAX_PALETTE_NAME_LENGTH) return 'too-long'
  const taken = saved.some((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase())
  return taken ? 'duplicate' : null
}

// Испорченные записи пропускаются, верные остаются
export function parseSavedPalettes(raw: unknown): SavedPalette[] {
  if (!Array.isArray(raw)) return []
  const result: SavedPalette[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const palette = parseSchedulePalette(item.palette)
    if (typeof item.id !== 'string' || item.id === '' || !palette) continue
    if (typeof item.name !== 'string' || item.name.trim() === '') continue
    result.push({ id: item.id, name: item.name, palette })
  }
  return result
}
