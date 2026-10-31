import { useState } from 'react'
import { validateSubject, type EventType, type ImportanceLevel, type Subject } from '../../core/catalog'
import {
  validateEventDraft,
  type EventDraft,
  type EventError,
  type EventFields,
  type EventRecord,
} from '../../core/events'
import { ru } from '../../i18n/ru'

interface Props {
  // null — новое событие
  event: EventRecord | null
  // Дата для нового события (двойной щелчок по клетке)
  defaultDate: string | null
  types: EventType[]
  levels: ImportanceLevel[]
  subjects: Subject[]
  onSave: (fields: EventFields) => void
  onAddSubject: (name: string, shortName: string) => Subject
  onArchive: () => void
  onDelete: () => void
  onClose: () => void
}

const NEW_SUBJECT = '__new__'
const t = ru.events.card

function toDraft(event: EventRecord | null, defaultDate: string | null): EventDraft {
  if (!event) {
    return {
      title: '',
      typeId: null,
      subjectId: null,
      startDate: defaultDate ?? '',
      endDate: defaultDate ?? '',
      time: '',
      importance: null,
      note: '',
      done: false,
    }
  }
  return {
    title: event.title,
    typeId: event.typeId,
    subjectId: event.subjectId,
    startDate: event.startDate ?? '',
    endDate: event.endDate ?? '',
    time: event.time ?? '',
    importance: event.importance,
    note: event.note,
    done: event.done,
  }
}

export function EventCard({
  event,
  defaultDate,
  types,
  levels,
  subjects,
  onSave,
  onAddSubject,
  onArchive,
  onDelete,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<EventDraft>(() => toDraft(event, defaultDate))
  const [error, setError] = useState<EventError | null>(null)
  const [addingSubject, setAddingSubject] = useState(false)
  const [newName, setNewName] = useState('')
  const [newShort, setNewShort] = useState('')
  const [subjectError, setSubjectError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function patch(change: Partial<EventDraft>) {
    setDraft((d) => ({ ...d, ...change }))
    setError(null)
  }

  function save() {
    const subject = subjects.find((s) => s.id === draft.subjectId) ?? null
    const type = types.find((x) => x.id === draft.typeId) ?? null
    const result = validateEventDraft(draft, subject, type)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSave(result.fields)
    onClose()
  }

  function addSubject() {
    const problem = validateSubject({ name: newName, shortName: newShort }, subjects)
    if (problem) {
      setSubjectError(ru.events.subjectErrors[problem])
      return
    }
    const created = onAddSubject(newName, newShort)
    patch({ subjectId: created.id })
    setAddingSubject(false)
    setNewName('')
    setNewShort('')
    setSubjectError(null)
  }

  return (
    <div className="overlay">
      <div
        className="card"
        role="dialog"
        aria-modal="true"
        aria-label={event ? t.titleEdit : t.titleNew}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      >
        <h2>{event ? t.titleEdit : t.titleNew}</h2>

        <label>
          {t.title}
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>

        <label>
          {t.subject}
          <select
            aria-label={t.subject}
            value={addingSubject ? NEW_SUBJECT : (draft.subjectId ?? '')}
            onChange={(e) => {
              if (e.target.value === NEW_SUBJECT) {
                setAddingSubject(true)
                return
              }
              setAddingSubject(false)
              patch({ subjectId: e.target.value === '' ? null : e.target.value })
            }}
          >
            <option value="">{t.noSubject}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value={NEW_SUBJECT}>{t.newSubject}</option>
          </select>
        </label>

        {addingSubject && (
          <fieldset className="card__subject">
            <label>
              {t.subjectName}
              <input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>
            <label>
              {t.subjectShort}
              <input value={newShort} onChange={(e) => setNewShort(e.target.value)} />
            </label>
            <button type="button" onClick={addSubject}>
              {t.subjectAdd}
            </button>
            {subjectError && (
              <p role="alert" className="controls__error">
                {subjectError}
              </p>
            )}
          </fieldset>
        )}

        <label>
          {t.type}
          <select
            aria-label={t.type}
            value={draft.typeId ?? ''}
            onChange={(e) => patch({ typeId: e.target.value === '' ? null : e.target.value })}
          >
            <option value="">{t.noType}</option>
            {types.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t.importance}
          <select
            aria-label={t.importance}
            value={draft.importance === null ? '' : String(draft.importance)}
            onChange={(e) =>
              patch({ importance: e.target.value === '' ? null : Number(e.target.value) })
            }
          >
            <option value="">{t.importanceAuto}</option>
            {[...levels]
              .sort((a, b) => a.order - b.order)
              .map((level) => (
                <option key={level.id} value={level.number}>
                  {level.name}
                </option>
              ))}
          </select>
        </label>

        <div className="card__row">
          <label>
            {t.start}
            <input
              type="date"
              value={draft.startDate}
              onChange={(e) => patch({ startDate: e.target.value })}
            />
          </label>
          <label>
            {t.end}
            <input
              type="date"
              value={draft.endDate}
              onChange={(e) => patch({ endDate: e.target.value })}
            />
          </label>
          <label>
            {t.time}
            <input
              type="time"
              value={draft.time}
              onChange={(e) => patch({ time: e.target.value })}
            />
          </label>
        </div>
        <p className="card__hint">{t.dateHint}</p>

        <label>
          {t.note}
          <textarea aria-label={t.note} value={draft.note} rows={3} onChange={(e) => patch({ note: e.target.value })} />
        </label>

        <label className="card__check">
          <input
            type="checkbox"
            checked={draft.done}
            onChange={(e) => patch({ done: e.target.checked })}
          />
          {t.done}
        </label>

        {error && (
          <p role="alert" className="controls__error">
            {ru.events.errors[error]}
          </p>
        )}

        <div className="card__buttons">
          <button type="button" onClick={save}>
            {t.save}
          </button>
          <button type="button" onClick={onClose}>
            {t.cancel}
          </button>
          {event && !confirmingDelete && (
            <>
              <button
                type="button"
                onClick={() => {
                  onArchive()
                  onClose()
                }}
              >
                {t.archive}
              </button>
              <button type="button" onClick={() => setConfirmingDelete(true)}>
                {t.delete}
              </button>
            </>
          )}
        </div>

        {event && confirmingDelete && (
          <div className="card__confirm" role="alertdialog" aria-label={t.deleteConfirm}>
            <p>{t.deleteConfirm}</p>
            <button
              type="button"
              onClick={() => {
                onDelete()
                onClose()
              }}
            >
              {t.deleteYes}
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)}>
              {t.deleteNo}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
