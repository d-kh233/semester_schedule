import { useState } from 'react'
import {
  isValidWeight,
  validateSubject,
  type EventType,
  type Subject,
} from '../../core/catalog'
import { subjectListText } from '../../core/deadlines'
import { isValidIsoDate } from '../../core/dates'
import type { EventRecord } from '../../core/events'
import { ru } from '../../i18n/ru'

interface Props {
  subjects: Subject[]
  events: EventRecord[]
  types: EventType[]
  onAdd: (name: string, shortName: string, weight: number) => void
  onUpdate: (id: string, patch: Pick<Subject, 'name' | 'shortName' | 'weight'>) => void
}

interface Draft {
  name: string
  shortName: string
  weight: string
}

// Ошибка проверки: код из validateSubject или «вес», либо null
function checkDraft(draft: Draft, subjects: Subject[], editingId?: string): string | null {
  const problem = validateSubject({ name: draft.name, shortName: draft.shortName }, subjects, editingId)
  if (problem) return ru.subjects.errors[problem]
  const weight = Number(draft.weight)
  if (draft.weight.trim() === '' || !isValidWeight(weight)) return ru.subjects.errors['weight-invalid']
  return null
}

// Окно «Предметы»: список по весу, добавление, правка, список дедлайнов для копирования
export function SubjectsPage({ subjects, events, types, onAdd, onUpdate }: Props) {
  const [adding, setAdding] = useState<Draft>({ name: '', shortName: '', weight: '1' })
  const [addError, setAddError] = useState<string | null>(null)
  const sorted = [...subjects].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'ru'))

  function add() {
    const problem = checkDraft(adding, subjects)
    if (problem) {
      setAddError(problem)
      return
    }
    setAddError(null)
    onAdd(adding.name.trim(), adding.shortName.trim(), Number(adding.weight))
    setAdding({ name: '', shortName: '', weight: '1' })
  }

  return (
    <section className="subjects" aria-label={ru.subjects.title}>
      <h2>{ru.subjects.title}</h2>

      {/* noValidate: проверку делает приложение, чтобы текст ошибки шёл из ru.ts, а не от браузера */}
      <form
        className="subjects__add"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input
          aria-label={ru.subjects.name}
          placeholder={ru.subjects.name}
          value={adding.name}
          onChange={(e) => setAdding({ ...adding, name: e.target.value })}
        />
        <input
          aria-label={ru.subjects.shortName}
          placeholder={ru.subjects.shortName}
          value={adding.shortName}
          onChange={(e) => setAdding({ ...adding, shortName: e.target.value })}
        />
        <input
          type="number"
          min={1}
          max={10}
          step={1}
          aria-label={ru.subjects.weight}
          value={adding.weight}
          onChange={(e) => setAdding({ ...adding, weight: e.target.value })}
        />
        <button type="submit">{ru.subjects.add}</button>
        {addError && <span role="alert">{addError}</span>}
      </form>

      {sorted.length === 0 ? (
        <p>{ru.subjects.empty}</p>
      ) : (
        <ul className="subjects__list" data-testid="subjects-list">
          {sorted.map((subject) => (
            <SubjectRow
              key={subject.id}
              subject={subject}
              subjects={subjects}
              events={events}
              types={types}
              onUpdate={onUpdate}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

interface RowProps {
  subject: Subject
  subjects: Subject[]
  events: EventRecord[]
  types: EventType[]
  onUpdate: Props['onUpdate']
}

function SubjectRow({ subject, subjects, events, types, onUpdate }: RowProps) {
  const [editing, setEditing] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [until, setUntil] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const untilDate = until !== '' && isValidIsoDate(until) ? until : null
  const text = subjectListText(subject, events, types, untilDate)
  const hasDeadlines = text.split('\n').length > 1

  function save() {
    if (!editing) return
    const problem = checkDraft(editing, subjects, subject.id)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    onUpdate(subject.id, {
      name: editing.name.trim(),
      shortName: editing.shortName.trim(),
      weight: Number(editing.weight),
    })
    setEditing(null)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(ru.subjects.copied)
    } catch {
      setCopied(ru.subjects.copyFailed)
    }
  }

  if (editing) {
    return (
      <li className="subjects__row">
        <input
          aria-label={ru.subjects.name}
          value={editing.name}
          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
        />
        <input
          aria-label={ru.subjects.shortName}
          value={editing.shortName}
          onChange={(e) => setEditing({ ...editing, shortName: e.target.value })}
        />
        <input
          type="number"
          min={1}
          max={10}
          step={1}
          aria-label={ru.subjects.weight}
          value={editing.weight}
          onChange={(e) => setEditing({ ...editing, weight: e.target.value })}
        />
        <button type="button" className="btn btn--accent" onClick={save}>
          {ru.subjects.save}
        </button>
        <button type="button" onClick={() => setEditing(null)}>
          {ru.subjects.cancel}
        </button>
        {error && <span role="alert">{error}</span>}
      </li>
    )
  }

  return (
    <li className="subjects__row">
      <span className="subjects__name">{subject.name}</span>
      <span className="events__meta">
        {subject.shortName} · {ru.subjects.weight} {subject.weight}
      </span>
      <button
        type="button"
        onClick={() =>
          setEditing({ name: subject.name, shortName: subject.shortName, weight: String(subject.weight) })
        }
      >
        {ru.subjects.edit}
      </button>
      <details>
        <summary>{ru.subjects.deadlinesTitle}</summary>
        {hasDeadlines ? (
          <textarea readOnly rows={Math.max(3, text.split('\n').length)} value={text} aria-label={subject.name} />
        ) : (
          <p>{ru.subjects.noDeadlines}</p>
        )}
        <label>
          {ru.subjects.copyUntil}{' '}
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
        </label>
        <button type="button" onClick={copy}>
          {ru.subjects.copy}
        </button>
        {copied && <span role="status">{copied}</span>}
      </details>
    </li>
  )
}
