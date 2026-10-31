// Автосборка палитры: из 3–7 базовых цветов собираются варианты (цвета месяцев с градацией
// по сезонам, цвета уровней важности, градиент дней недели). Ничего не применяется само:
// вариант выбирает пользователь (BR-11).

import { hexToHsl, hslToHex, isHexColor, mixHex, type WeekGradient } from './colors'

export const MIN_BASE_COLORS = 3
export const MAX_BASE_COLORS = 7

export interface PaletteVariant {
  weekGradient: WeekGradient
  // Индекс 0 — январь, 11 — декабрь
  monthColors: string[]
  // Цвет уровня с номером i + 1
  levelColors: string[]
}

export type BaseColorsError = 'too-few' | 'too-many' | 'duplicate' | 'invalid'

export function validateBaseColors(colors: string[]): BaseColorsError | null {
  if (colors.some((c) => !isHexColor(c))) return 'invalid'
  if (colors.length < MIN_BASE_COLORS) return 'too-few'
  if (colors.length > MAX_BASE_COLORS) return 'too-many'
  const unique = new Set(colors.map((c) => c.toLowerCase()))
  return unique.size === colors.length ? null : 'duplicate'
}

// 3 цвета — 4 варианта, 4 цвета — 5, от 5 — 6
export function variantCount(baseCount: number): number {
  return Math.min(6, Math.max(4, baseCount + 1))
}

// Сезон: 0 зима (дек–фев), 1 весна, 2 лето, 3 осень. position — место месяца в сезоне (0–2).
export function seasonOfMonth(monthIndex: number): { season: number; position: number } {
  const fromDecember = (monthIndex + 1) % 12
  return { season: Math.floor(fromDecember / 3), position: fromDecember % 3 }
}

// Светлота середины сезона: зима светлая, осень самая тёмная; внутри сезона месяц темнеет
const SEASON_LIGHTNESS = [0.84, 0.7, 0.56, 0.42] as const
const MONTH_STEP = 0.06

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// У серого базового цвета оттенка нет, насыщенность остаётся нулевой
function saturationOf(base: string, min: number, max: number): number {
  const s = hexToHsl(base)[1]
  return s === 0 ? 0 : clamp(s, min, max)
}

function monthColor(base: string, monthIndex: number): string {
  const { season, position } = seasonOfMonth(monthIndex)
  const centre = SEASON_LIGHTNESS[season] ?? 0.6
  const lightness = centre + (1 - position) * MONTH_STEP
  return hslToHex(hexToHsl(base)[0], saturationOf(base, 0.3, 0.8), lightness)
}

// Уровень 1 самый яркий и тёмный, каждый следующий светлее
function levelColors(base: string, count: number): string[] {
  const [hue] = hexToHsl(base)
  const saturation = saturationOf(base, 0.4, 0.85)
  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1)
    return hslToHex(hue, saturation, 0.5 + 0.36 * t)
  })
}

// Опорные дни недели (0 = пн ... 6 = вс) для 3–7 базовых цветов. Цвета между опорными днями
// смешиваются плавно: пн — первый цвет, ср — второй, вс — последний.
const WEEK_ANCHORS: Record<number, number[]> = {
  3: [0, 2, 6],
  4: [0, 2, 4, 6],
  5: [0, 1, 2, 4, 6],
  6: [0, 1, 2, 3, 4, 6],
  7: [0, 1, 2, 3, 4, 5, 6],
}

export function weekdayColorsFromBases(baseColors: string[]): string[] {
  const anchors = validateBaseColors(baseColors) === null ? WEEK_ANCHORS[baseColors.length] : undefined
  if (!anchors) return []
  return Array.from({ length: 7 }, (_, day) => {
    const next = anchors.findIndex((a) => a >= day)
    const to = anchors[next] ?? 6
    if (to === day) return baseColors[next] ?? '#cccccc'
    const from = anchors[next - 1] ?? 0
    const t = (day - from) / (to - from)
    return mixHex(baseColors[next - 1] ?? '#cccccc', baseColors[next] ?? '#cccccc', t)
  })
}

function weekGradient(baseColors: string[]): WeekGradient {
  const days = weekdayColorsFromBases(baseColors)
  const lightness = (c: string) => hexToHsl(c)[2]
  const sorted = [...days].sort((x, y) => lightness(x) - lightness(y))
  // light и dark нужны ручным полям; цвета дней задаёт days
  return { light: sorted[sorted.length - 1] ?? '#ffffff', dark: sorted[0] ?? '#000000', days }
}

// Дни недели берут базовые цвета в порядке пользователя. Варианты отличаются тем, какой базовый
// цвет достаётся сезонам и уровням важности.
// Первые варианты сдвигают цвета по кругу, следующие идут по сезонам в обратном порядке.
export function buildPaletteVariants(baseColors: string[], levelCount: number): PaletteVariant[] {
  if (validateBaseColors(baseColors) !== null) return []
  const n = baseColors.length
  const levels = Math.max(1, levelCount)
  const pick = (index: number) => baseColors[((index % n) + n) % n] ?? baseColors[0] ?? '#cccccc'

  return Array.from({ length: variantCount(n) }, (_, k) => {
    const shift = k % n
    const reversed = Math.floor(k / n) % 2 === 1
    const seasonBase = (season: number) => pick(reversed ? shift - season : shift + season)
    return {
      weekGradient: weekGradient(baseColors),
      monthColors: Array.from({ length: 12 }, (_, month) =>
        monthColor(seasonBase(seasonOfMonth(month).season), month),
      ),
      levelColors: levelColors(pick(shift + 1), levels),
    }
  })
}
