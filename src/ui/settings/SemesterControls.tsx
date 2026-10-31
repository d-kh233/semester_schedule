import { useState } from 'react'
import { validateSemester } from '../../core/calendar'
import type { Semester } from '../../core/model'
import type { NonexistentDaysMode, Settings } from '../../core/settings'
import { ru } from '../../i18n/ru'

interface Props {
  semester: Semester
  settings: Settings
  onDatesChange: (start: string, end: string) => void
  onSettingsChange: (patch: Partial<Settings>) => void
}

// Вызывать с key = id расписания: поля дат начинаются заново при переключении расписания
export function SemesterControls({ semester, settings, onDatesChange, onSettingsChange }: Props) {
  const [start, setStart] = useState(semester.startDate)
  const [end, setEnd] = useState(semester.endDate)
  const error = validateSemester(start, end)

  // Сетка меняется только на верном семестре; пока даты неверны, остаётся прежняя
  function changeDates(nextStart: string, nextEnd: string) {
    setStart(nextStart)
    setEnd(nextEnd)
    if (validateSemester(nextStart, nextEnd) === null) onDatesChange(nextStart, nextEnd)
  }

  return (
    <section className="controls">
      <label>
        {ru.controls.semesterStart}
        <input type="date" value={start} onChange={(e) => changeDates(e.target.value, end)} />
      </label>
      <label>
        {ru.controls.semesterEnd}
        <input type="date" value={end} onChange={(e) => changeDates(start, e.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={settings.mutePastDays}
          onChange={(e) => onSettingsChange({ mutePastDays: e.target.checked })}
        />
        {ru.controls.mutePast}
      </label>
      <label>
        {ru.controls.nonexistentDays}
        <select
          value={settings.nonexistentDays}
          onChange={(e) =>
            onSettingsChange({ nonexistentDays: e.target.value as NonexistentDaysMode })
          }
        >
          <option value="gray">{ru.controls.nonexistentGray}</option>
          <option value="hidden">{ru.controls.nonexistentHidden}</option>
        </select>
      </label>
      {error && (
        <p role="alert" className="controls__error">
          {ru.semesterErrors[error]}
        </p>
      )}
    </section>
  )
}
