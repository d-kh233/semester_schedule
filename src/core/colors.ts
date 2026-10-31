// Цвета в формате #rrggbb и градиент дней недели

export interface WeekGradient {
  light: string
  dark: string
  // Свой цвет каждого дня (пн–вс); если задан, он сильнее light и dark
  days?: string[]
}

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

export function isHexColor(value: string): boolean {
  return HEX_PATTERN.test(value)
}

function channels(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function toHex(value: number): string {
  return Math.round(value).toString(16).padStart(2, '0')
}

// t = 0 даёт цвет a, t = 1 даёт цвет b
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = channels(a)
  const [br, bg, bb] = channels(b)
  const mixed = [ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]
  return `#${mixed.map(toHex).join('')}`
}

// Оттенок 0–360, насыщенность и светлота 0–1
export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map((c) => c / 255) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = (((h % 360) + 360) % 360) / 360
  const sat = Math.min(1, Math.max(0, s))
  const light = Math.min(1, Math.max(0, l))
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat
  const p = 2 * light - q
  const channel = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return `#${[channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)]
    .map((c) => toHex(c * 255))
    .join('')}`
}

// Насколько тёмным должен быть день: 1 = самый тёмный, 0 = самый светлый.
// Индекс: 0 = понедельник ... 6 = воскресенье. Среда светлая, понедельник и воскресенье тёмные.
const WEEKDAY_WEIGHTS = [1, 0.5, 0, 0.25, 0.5, 0.75, 1] as const

export function weekdayWeight(weekdayIndex: number): number {
  const weight = WEEKDAY_WEIGHTS[weekdayIndex]
  if (weight === undefined) throw new Error(`Неверный день недели: ${weekdayIndex}`)
  return weight
}

export function weekdayColor(weekdayIndex: number, gradient: WeekGradient): string {
  const own = gradient.days?.[weekdayIndex]
  if (own !== undefined && isHexColor(own)) return own
  return mixHex(gradient.light, gradient.dark, weekdayWeight(weekdayIndex))
}

// Цвет текста, читаемый на заливке: светлый на тёмной, тёмный на светлой
export function contrastText(background: string): string {
  const [r, g, b] = channels(background)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance < 0.55 ? '#ffffff' : '#1f1f1f'
}

// Цвет текста дня недели по цвету его заливки из градиента
export function weekdayTextColor(weekdayIndex: number, gradient: WeekGradient): string {
  return contrastText(weekdayColor(weekdayIndex, gradient))
}
