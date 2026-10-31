// Цвета в формате #rrggbb и градиент дней недели

export interface WeekGradient {
  light: string
  dark: string
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

// Насколько тёмным должен быть день: 1 = самый тёмный, 0 = самый светлый.
// Индекс: 0 = понедельник ... 6 = воскресенье. Среда светлая, понедельник и воскресенье тёмные.
const WEEKDAY_WEIGHTS = [1, 0.5, 0, 0.25, 0.5, 0.75, 1] as const

export function weekdayWeight(weekdayIndex: number): number {
  const weight = WEEKDAY_WEIGHTS[weekdayIndex]
  if (weight === undefined) throw new Error(`Неверный день недели: ${weekdayIndex}`)
  return weight
}

export function weekdayColor(weekdayIndex: number, gradient: WeekGradient): string {
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
