import { useState, type ReactNode } from 'react'
import type { SaveState } from '../../app/useAppData'
import type { Semester } from '../../core/model'
import { ru } from '../../i18n/ru'

interface Props {
  semesters: Semester[]
  activeId: string
  saveState: SaveState
  onSelect: (id: string) => void
  onFit: () => void
  onResort: () => void
  deadlinesOpen: boolean
  onToggleDeadlines: () => void
  onOpenSettings: () => void
  // Строка ввода занимает всю ширину панели
  children: ReactNode
}

export function TopBar({
  semesters,
  activeId,
  saveState,
  onSelect,
  onFit,
  onResort,
  deadlinesOpen,
  onToggleDeadlines,
  onOpenSettings,
  children,
}: Props) {
  const [confirmResort, setConfirmResort] = useState(false)
  const visible = semesters.filter((s) => !s.archived)

  return (
    <header className="topbar">
      <div className="topbar__row">
        <h1>{ru.appTitle}</h1>
        <select
          aria-label={ru.schedules.switcher}
          value={activeId}
          data-testid="schedule-select"
          onChange={(e) => onSelect(e.target.value)}
        >
          {visible.map((s) => (
            <option key={s.id} value={s.id}>
              {s.isDemo ? `${s.name} (${ru.schedules.demoMark})` : s.name}
            </option>
          ))}
        </select>
        <span
          className={`save-state save-state--${saveState}`}
          role={saveState === 'error' ? 'alert' : 'status'}
          data-testid="save-state"
        >
          {ru.save[saveState]}
        </span>
        <span className="topbar__spacer" />
        {confirmResort ? (
          <span role="group" aria-label={ru.grid.resort} className="topbar__confirm">
            {ru.grid.resortConfirm}
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                setConfirmResort(false)
                onResort()
              }}
            >
              {ru.grid.resortYes}
            </button>
            <button type="button" className="btn" onClick={() => setConfirmResort(false)}>
              {ru.grid.resortNo}
            </button>
          </span>
        ) : (
          <>
            <button type="button" className="btn" onClick={onFit}>
              {ru.grid.fitWidth}
            </button>
            <button type="button" className="btn" onClick={() => setConfirmResort(true)}>
              {ru.grid.resort}
            </button>
            <button
              type="button"
              className={deadlinesOpen ? 'btn btn--active' : 'btn'}
              aria-pressed={deadlinesOpen}
              onClick={onToggleDeadlines}
            >
              {ru.topbar.deadlines}
            </button>
            <button type="button" className="btn" onClick={onOpenSettings}>
              {ru.topbar.settings}
            </button>
          </>
        )}
      </div>
      {children}
    </header>
  )
}
