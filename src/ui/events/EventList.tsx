import type { EventType, ImportanceLevel, Subject } from '../../core/catalog'
import { formatDateRu } from '../../core/dates'
import { compareEvents, eventColor, type EventRecord } from '../../core/events'
import { ru } from '../../i18n/ru'

interface Props {
  events: EventRecord[]
  types: EventType[]
  levels: ImportanceLevel[]
  subjects: Subject[]
  onAdd: () => void
  onOpen: (id: string) => void
  onRestore: (id: string) => void
}

function dateText(event: EventRecord): string {
  if (event.startDate === null || event.endDate === null) return ru.events.noDate
  const start = formatDateRu(event.startDate)
  const end = formatDateRu(event.endDate)
  const dates = start === end ? start : `${start} – ${end}`
  return event.time ? `${dates} ${event.time}` : dates
}

// Временный список: показывает события, пока блоков в сетке нет
export function EventList({ events, types, levels, subjects, onAdd, onOpen, onRestore }: Props) {
  const sorted = [...events].sort((a, b) => compareEvents(a, b, types))
  const live = sorted.filter((e) => !e.archived)
  const archived = sorted.filter((e) => e.archived)

  return (
    <section className="events">
      <div className="events__head">
        <h2>{ru.events.listTitle}</h2>
        <button type="button" onClick={onAdd}>
          {ru.events.add}
        </button>
      </div>
      <p className="events__note">{ru.events.listNote}</p>

      {live.length === 0 ? (
        <p>{ru.events.empty}</p>
      ) : (
        <ul className="events__list" data-testid="event-list">
          {live.map((event) => {
            const type = types.find((x) => x.id === event.typeId) ?? null
            const subject = subjects.find((s) => s.id === event.subjectId) ?? null
            const color = eventColor(event, type, levels)
            return (
              <li key={event.id} className={event.done ? 'is-done' : undefined}>
                <span
                  className={color ? 'chip' : 'chip chip--none'}
                  style={color ? { background: color } : undefined}
                  data-testid={`event-chip-${event.id}`}
                  data-color={color ?? ''}
                />
                <button
                  type="button"
                  className="events__title"
                  title={ru.events.open}
                  onClick={() => onOpen(event.id)}
                >
                  {event.title}
                </button>
                <span className="events__meta">
                  {[subject?.name, type?.name, dateText(event)].filter(Boolean).join(' · ')}
                  {event.done ? ` · ${ru.events.done}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      <h3>{ru.events.archiveTitle}</h3>
      {archived.length === 0 ? (
        <p>{ru.events.archiveEmpty}</p>
      ) : (
        <ul className="events__list" data-testid="event-archive">
          {archived.map((event) => (
            <li key={event.id}>
              <span className="events__title">{event.title}</span>
              <span className="events__meta">{dateText(event)}</span>
              <button type="button" onClick={() => onRestore(event.id)}>
                {ru.events.restore}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
