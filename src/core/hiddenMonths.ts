// Скрытые месяцы: это только вид сетки, события не затрагиваются.
// Ключ месяца как в календаре: «ГГГГ-ММ».

import type { CalendarMonth } from './calendar'

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/

function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && MONTH_KEY.test(value)
}

// Читает список из хранилища: всё лишнее отбрасывается, повторы убираются, по порядку
export function parseHiddenMonths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter(isMonthKey))].sort()
}

// Месяцы для показа в сетке
export function visibleMonths(months: CalendarMonth[], hidden: string[]): CalendarMonth[] {
  return months.filter((m) => !hidden.includes(m.key))
}

// Сколько скрытых месяцев есть в этом календаре (для кнопки «Показать всё»)
export function countHiddenMonths(months: CalendarMonth[], hidden: string[]): number {
  return months.filter((m) => hidden.includes(m.key)).length
}

// Скрывает месяц или возвращает, если он уже скрыт; исходный список не меняется
export function toggleHiddenMonth(hidden: string[], key: string): string[] {
  const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key]
  return next.sort()
}
