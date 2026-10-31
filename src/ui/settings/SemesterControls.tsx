import type { SemesterError } from '../../core/calendar'
import type { NonexistentDaysMode, Settings } from '../../core/settings'
import { ru } from '../../i18n/ru'

interface Props {
  settings: Settings
  draftStart: string
  draftEnd: string
  error: SemesterError | null
  onDatesChange: (start: string, end: string) => void
  onSettingsChange: (patch: Partial<Settings>) => void
}

export function SemesterControls({
  settings,
  draftStart,
  draftEnd,
  error,
  onDatesChange,
  onSettingsChange,
}: Props) {
  return (
    <section className="controls">
      <label>
        {ru.controls.semesterStart}
        <input
          type="date"
          value={draftStart}
          onChange={(e) => onDatesChange(e.target.value, draftEnd)}
        />
      </label>
      <label>
        {ru.controls.semesterEnd}
        <input
          type="date"
          value={draftEnd}
          onChange={(e) => onDatesChange(draftStart, e.target.value)}
        />
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
