import { useState } from 'react'
import { validateSemester, type SemesterError } from '../../core/calendar'
import { validateScheduleName, type ScheduleNameError, type Semester } from '../../core/model'
import { defaultSemesterDates } from '../../core/settings'
import { ru } from '../../i18n/ru'

interface Props {
  semesters: Semester[]
  onCreate: (name: string, startDate: string, endDate: string) => void
  onRename: (id: string, name: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
}

function RenameInput({ semester, onRename }: { semester: Semester; onRename: Props['onRename'] }) {
  const [value, setValue] = useState(semester.name)
  const error = validateScheduleName(value)

  function commit() {
    if (error === null && value.trim() !== semester.name) onRename(semester.id, value.trim())
    else setValue(semester.name)
  }

  return (
    <input
      aria-label={ru.schedules.rename}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setValue(semester.name)
      }}
    />
  )
}

export function ScheduleManager({ semesters, onCreate, onRename, onArchive, onRestore }: Props) {
  const [name, setName] = useState('')
  const [start, setStart] = useState<string>(defaultSemesterDates.start)
  const [end, setEnd] = useState<string>(defaultSemesterDates.end)
  const [error, setError] = useState<ScheduleNameError | SemesterError | null>(null)

  const active = semesters.filter((s) => !s.archived)
  const archived = semesters.filter((s) => s.archived)

  function create() {
    const problem = validateScheduleName(name) ?? validateSemester(start, end)
    setError(problem)
    if (problem) return
    onCreate(name.trim(), start, end)
    setName('')
  }

  const errorText =
    error === null
      ? null
      : error === 'empty' || error === 'too-long'
        ? ru.schedules.nameErrors[error]
        : ru.semesterErrors[error]

  return (
    <div className="schedules">
      <div className="schedules__body">
        <fieldset>
          <legend>{ru.schedules.newTitle}</legend>
          <label>
            {ru.schedules.nameLabel}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            {ru.controls.semesterStart}
            <input
              type="date"
              aria-label={`${ru.schedules.newTitle}: ${ru.controls.semesterStart}`}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            {ru.controls.semesterEnd}
            <input
              type="date"
              aria-label={`${ru.schedules.newTitle}: ${ru.controls.semesterEnd}`}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <button type="button" onClick={create}>
            {ru.schedules.create}
          </button>
          {errorText && (
            <p role="alert" className="controls__error">
              {errorText}
            </p>
          )}
        </fieldset>

        <ul className="schedules__list">
          {active.map((s) => (
            <li key={s.id}>
              <RenameInput key={`${s.id}-${s.name}`} semester={s} onRename={onRename} />
              <button
                type="button"
                disabled={active.length === 1}
                title={active.length === 1 ? ru.schedules.lastOne : undefined}
                onClick={() => onArchive(s.id)}
              >
                {ru.schedules.archive}
              </button>
            </li>
          ))}
        </ul>

        <h3>{ru.schedules.archivedTitle}</h3>
        {archived.length === 0 ? (
          <p>{ru.schedules.archivedEmpty}</p>
        ) : (
          <ul className="schedules__list" data-testid="archived-schedules">
            {archived.map((s) => (
              <li key={s.id}>
                <span>{s.name}</span>
                <button type="button" onClick={() => onRestore(s.id)}>
                  {ru.schedules.restore}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
