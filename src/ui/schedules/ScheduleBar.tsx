import type { SaveState } from '../../app/useAppData'
import type { Semester } from '../../core/model'
import { ru } from '../../i18n/ru'

interface Props {
  semesters: Semester[]
  activeId: string | null
  saveState: SaveState
  onSelect: (id: string) => void
}

export function ScheduleBar({ semesters, activeId, saveState, onSelect }: Props) {
  const visible = semesters.filter((s) => !s.archived)
  return (
    <div className="schedule-bar">
      <label>
        {ru.schedules.switcher}
        <select
          value={activeId ?? ''}
          data-testid="schedule-select"
          onChange={(e) => onSelect(e.target.value)}
        >
          {visible.map((s) => (
            <option key={s.id} value={s.id}>
              {s.isDemo ? `${s.name} (${ru.schedules.demoMark})` : s.name}
            </option>
          ))}
        </select>
      </label>
      <span
        className={`save-state save-state--${saveState}`}
        role={saveState === 'error' ? 'alert' : 'status'}
        data-testid="save-state"
      >
        {ru.save[saveState]}
      </span>
    </div>
  )
}
