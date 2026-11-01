import { useState, type ReactNode } from 'react'
import type { SaveState } from '../../app/useAppData'
import type { Semester } from '../../core/model'
import { ru } from '../../i18n/ru'

export type View = 'grid' | 'list'

interface Props {
  semesters: Semester[]
  activeId: string
  saveState: SaveState
  onSelect: (id: string) => void
  onFit: () => void
  onResort: () => void
  // Сколько месяцев скрыто в сетке; кнопка «Показать всё» видна, только если есть скрытые
  hiddenCount: number
  onShowAllMonths: () => void
  view: View
  onViewChange: (view: View) => void
  onOpenSettings: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
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
  hiddenCount,
  onShowAllMonths,
  view,
  onViewChange,
  onOpenSettings,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
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
        <button
          type="button"
          className="btn"
          data-testid="undo"
          title={ru.topbar.undoTitle}
          disabled={!canUndo}
          onClick={onUndo}
        >
          {ru.topbar.undo}
        </button>
        <button
          type="button"
          className="btn"
          data-testid="redo"
          title={ru.topbar.redoTitle}
          disabled={!canRedo}
          onClick={onRedo}
        >
          {ru.topbar.redo}
        </button>
        {view === 'grid' && confirmResort ? (
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
            {view === 'grid' && (
              <>
                <button type="button" className="btn" onClick={onFit}>
                  {ru.grid.fitWidth}
                </button>
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    className="btn"
                    data-testid="show-all-months"
                    onClick={onShowAllMonths}
                  >
                    {`${ru.grid.showAllMonths} (${hiddenCount})`}
                  </button>
                )}
                <button type="button" className="btn" onClick={() => setConfirmResort(true)}>
                  {ru.grid.resort}
                </button>
              </>
            )}
            <button type="button" className="btn" onClick={onOpenSettings}>
              {ru.topbar.settings}
            </button>
          </>
        )}
      </div>
      <div className="tabs" role="tablist" aria-label={ru.topbar.tabs}>
        {(
          [
            ['grid', ru.topbar.gridTab],
            ['list', ru.topbar.deadlines],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={view === id ? 'tab tab--active' : 'tab'}
            onClick={() => onViewChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {children}
    </header>
  )
}
