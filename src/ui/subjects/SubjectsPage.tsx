import { useState, type FormEvent } from 'react'
import {
  isValidWeight,
  validateSubject,
  type EventType,
  type Subject,
} from '../../core/catalog'
import { subjectListText } from '../../core/deadlines'
import type { EventRecord } from '../../core/events'
import { ru } from '../../i18n/ru'
import { CopyText } from '../common/CopyText'

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

const EMPTY_DRAFT: Draft = { name: '', shortName: '', weight: '1' }

// Ошибка проверки формы (текст из ru.ts) или null
function checkDraft(draft: Draft, subjects: Subject[], editingId?: string): string | null {
  const problem = validateSubject(
    { name: draft.name, shortName: draft.shortName },
    subjects,
    editingId,
  )
  if (problem) return ru.subjects.errors[problem]
  if (draft.weight.trim() === '' || !isValidWeight(Number(draft.weight))) {
    return ru.subjects.errors['weight-invalid']
  }
  return null
}

// Поля имени, короткого имени и веса; одно и то же в форме добавления и в правке строки
function SubjectFields({ draft, onChange }: { draft: Draft; onChange: (draft: Draft) => void }) {
  return (
    <>
      <label className="field field--name">
        <span>{ru.subjects.name}</span>
        <input
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </label>
      <label className="field">
        <span>{ru.subjects.shortName}</span>
        <input
          value={draft.shortName}
          onChange={(e) => onChange({ ...draft, shortName: e.target.value })}
        />
      </label>
      <label className="field field--weight">
        <span>{ru.subjects.weight}</span>
        <input
          type="number"
          min={1}
          max={10}
          step={1}
          aria-label={ru.subjects.weight}
          value={draft.weight}
          onChange={(e) => onChange({ ...draft, weight: e.target.value })}
        />
      </label>
    </>
  )
}

// Окно «Предметы»: добавление, список по весу, правка и копирование дедлайнов предмета
export function SubjectsPage({ subjects, events, types, onAdd, onUpdate }: Props) {
  const [adding, setAdding] = useState<Draft>(EMPTY_DRAFT)
  const [addError, setAddError] = useState<string | null>(null)
  const sorted = [...subjects].sort(
    (a, b) => b.weight - a.weight || a.name.localeCompare(b.name, 'ru'),
  )

  function add(e: FormEvent) {
    e.preventDefault()
    const problem = checkDraft(adding, subjects)
    if (problem) {
      setAddError(problem)
      return
    }
    setAddError(null)
    onAdd(adding.name.trim(), adding.shortName.trim(), Number(adding.weight))
    setAdding(EMPTY_DRAFT)
  }

  return (
    <section className="subjects" aria-label={ru.subjects.title}>
      <div className="subjects__head">
        <h2>{ru.subjects.title}</h2>
        <p className="subjects__hint">{ru.subjects.hint}</p>
      </div>

      <form className="subjects__add" noValidate onSubmit={add}>
        <SubjectFields draft={adding} onChange={setAdding} />
        <button type="submit" className="btn btn--primary">
          {ru.subjects.add}
        </button>
        {addError && (
          <p role="alert" className="form-error">
            {addError}
          </p>
        )}
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
  const datedCount = events.filter(
    (e) => e.subjectId === subject.id && !e.archived && e.endDate !== null,
  ).length

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

  if (editing) {
    return (
      <li className="subjects__row subjects__row--edit">
        <SubjectFields draft={editing} onChange={setEditing} />
        <div className="subjects__actions">
          <button type="button" className="btn btn--primary" onClick={save}>
            {ru.subjects.save}
          </button>
          <button type="button" className="btn" onClick={() => setEditing(null)}>
            {ru.subjects.cancel}
          </button>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </li>
    )
  }

  return (
    <li className="subjects__row">
      <div className="subjects__main">
        <span className="subjects__name">{subject.name}</span>
        <span className="subjects__short">{subject.shortName}</span>
      </div>
      <span className="subjects__weight">{`${ru.subjects.weight} ${subject.weight}`}</span>
      <span className="subjects__count">{`${ru.subjects.deadlinesCount}: ${datedCount}`}</span>
      <button
        type="button"
        className="btn"
        onClick={() =>
          setEditing({
            name: subject.name,
            shortName: subject.shortName,
            weight: String(subject.weight),
          })
        }
      >
        {ru.subjects.edit}
      </button>
      <details className="subjects__deadlines">
        <summary>{ru.subjects.deadlinesTitle}</summary>
        <CopyText
          ariaLabel={subject.name}
          emptyText={ru.subjects.noDeadlines}
          textFor={(until) => subjectListText(subject, events, types, until)}
        />
      </details>
    </li>
  )
}
