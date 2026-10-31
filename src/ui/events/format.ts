import { DEFAULT_CROWDED_DAYS, isCrowdedDate } from '../../core/crowded'
import { formatDateRu } from '../../core/dates'
import type { EventRecord } from '../../core/events'
import { ru } from '../../i18n/ru'

// «21.10.2026», «13.10.2026 – 15.11.2026 17:00», «без даты»
export function dateText(event: EventRecord): string {
  if (event.startDate === null || event.endDate === null) return ru.events.noDate
  const start = formatDateRu(event.startDate)
  const end = formatDateRu(event.endDate)
  const dates = start === end ? start : `${start} – ${end}`
  return event.time ? `${dates} ${event.time}` : dates
}

// Окна практики: «10.12.2026 (планируемое), 28.12.2026 (людное)»; пусто, если окно одно
export function windowsText(event: EventRecord): string {
  if (event.windows.length < 2) return ''
  const items = event.windows.map((w) => {
    const date = formatDateRu(w.endDate)
    const marks = [
      w.planned ? ru.events.plannedWindow : null,
      isCrowdedDate(w.endDate, DEFAULT_CROWDED_DAYS) ? ru.events.crowdedWindow : null,
    ].filter(Boolean)
    return marks.length > 0 ? `${date} (${marks.join(', ')})` : date
  })
  return `${ru.events.windows}: ${items.join(', ')}`
}
