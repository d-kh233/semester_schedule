import { useState } from 'react'
import type { EventType, ImportanceLevel, Subject } from '../../core/catalog'
import { deadlineListText, sortDeadlines, undatedEvents } from '../../core/deadlines'
import { compareIsoDates, isValidIsoDate, type IsoDate } from '../../core/dates'
import { eventColor, type EventRecord } from '../../core/events'
import { ru } from '../../i18n/ru'
import { CopyText } from '../common/CopyText'
import { dateText, windowsText } from './format'

interface Props {
  events: EventRecord[]
  types: EventType[]
  levels: ImportanceLevel[]
  subjects: Subject[]
  semesterStart: IsoDate
  semesterEnd: IsoDate
  onAdd: () => void
  onImport: () => void
  onOpen: (id: string) => void
  onRestore: (id: string) => void
  onToggleDone: (id: string, done: boolean) => void
  onAssignDate: (id: string, date: IsoDate) => void
}

// Содержимое окна «Список дедлайнов»: дедлайны с датой слева, «Когда-нибудь» справа, ниже архив
export function EventList({
  events,
  types,
  levels,
  subjects,
  semesterStart,
  semesterEnd,
  onAdd,
  onImport,
  onOpen,
  onRestore,
  onToggleDone,
  onAssignDate,
}: Props) {
  const dated = sortDeadlines(events, types, subjects)
  const someday = undatedEvents(events)
  const archived = events.filter((e) => e.archived)

  const typeOf = (e: EventRecord) => types.find((x) => x.id === e.typeId) ?? null
  const subjectOf = (e: EventRecord) => subjects.find((s) => s.id === e.subjectId) ?? null

  return (
    <section className="events">
      <div className="events__head">
        <h3>{ru.deadlines.untilEnd}</h3>
        <button type="button" onClick={onImport}>
          {ru.importText.button}
        </button>
        <button type="button" onClick={onAdd}>
          {ru.events.add}
        </button>
      </div>

      <div className="events__columns">
        <div className="events__main">
          <details className="events__export">
            <summary>{ru.copyText.listSummary}</summary>
            <CopyText
              ariaLabel={ru.copyText.listLabel}
              emptyText={ru.copyText.listEmpty}
              textFor={(until) => deadlineListText(events, types, subjects, until)}
            />
          </details>

          {dated.length === 0 ? (
            <p>{ru.events.empty}</p>
          ) : (
            <ul className="events__list" data-testid="event-list">
              {dated.map((event) => {
                const color = eventColor(event, typeOf(event), levels)
                return (
                  <li key={event.id} className={event.done ? 'is-done' : undefined}>
                    <input
                      type="checkbox"
                      checked={event.done}
                      aria-label={`${ru.deadlines.doneCheck}: ${event.title}`}
                      onChange={(e) => onToggleDone(event.id, e.target.checked)}
                    />
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
                      {[subjectOf(event)?.name, typeOf(event)?.name, dateText(event), windowsText(event)]
                        .filter(Boolean)
                        .join(' · ')}
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
        </div>

        <aside className="events__someday" aria-label={ru.deadlines.someday}>
          <h3>{ru.deadlines.someday}</h3>
          {someday.length === 0 ? (
            <p>{ru.deadlines.somedayEmpty}</p>
          ) : (
            <ul className="events__list" data-testid="someday-list">
              {someday.map((event) => (
                <SomedayRow
                  key={event.id}
                  event={event}
                  meta={[subjectOf(event)?.name, typeOf(event)?.name].filter(Boolean).join(' · ')}
                  semesterStart={semesterStart}
                  semesterEnd={semesterEnd}
                  onOpen={() => onOpen(event.id)}
                  onAssign={(date) => onAssignDate(event.id, date)}
                />
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  )
}

interface SomedayRowProps {
  event: EventRecord
  meta: string
  semesterStart: IsoDate
  semesterEnd: IsoDate
  onOpen: () => void
  onAssign: (date: IsoDate) => void
}

// Дело без даты: открыть карточку или назначить дату (дата должна быть в семестре)
function SomedayRow({ event, meta, semesterStart, semesterEnd, onOpen, onAssign }: SomedayRowProps) {
  const [date, setDate] = useState('')
  const [error, setError] = useState(false)

  function assign() {
    const inSemester =
      isValidIsoDate(date) &&
      compareIsoDates(date, semesterStart) >= 0 &&
      compareIsoDates(date, semesterEnd) <= 0
    if (!inSemester) {
      setError(true)
      return
    }
    setError(false)
    onAssign(date)
  }

  return (
    <li className="someday__row">
      <button type="button" className="events__title" title={ru.events.open} onClick={onOpen}>
        {event.title}
      </button>
      <span className="events__meta">{meta}</span>
      <div className="someday__assign">
        <input
          type="date"
          value={date}
          min={semesterStart}
          max={semesterEnd}
          aria-label={ru.deadlines.assignDateInput}
          onChange={(e) => {
            setDate(e.target.value)
            setError(false)
          }}
        />
        <button type="button" onClick={assign}>
          {ru.deadlines.assignDate}
        </button>
      </div>
      {error && (
        <span role="alert" className="form-error">
          {ru.deadlines.assignOutside}
        </span>
      )}
    </li>
  )
}
