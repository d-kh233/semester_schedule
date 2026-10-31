import { useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { buildCalendar, getDayTiming, weekNumber, type CalendarDay } from '../../core/calendar'
import { contrastText, weekdayColor } from '../../core/colors'
import { parseIsoDate, type IsoDate } from '../../core/dates'
import {
  DAYS_IN_ROW,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_MONTH_COLUMN_WIDTH,
  clampColumnWidth,
  clampMonthColumnWidth,
  fitColumnWidth,
  resolveWeekOneMonday,
  type Semester,
} from '../../core/model'
import type { Settings } from '../../core/settings'
import { ru } from '../../i18n/ru'
import { WeekNumber } from './WeekNumber'
import './grid.css'

interface Props {
  semester: Semester
  settings: Settings
  today: IsoDate
  onWeekNumberChange: (monday: IsoDate, number: number) => void
  onWidthsChange: (columnWidths: number[], monthColumnWidth: number) => void
}

interface Widths {
  columns: number[]
  month: number
}

function cellClasses(day: CalendarDay, today: IsoDate, settings: Settings): string {
  const classes = ['cell']
  if (day.date === null || day.status !== 'normal') {
    classes.push(settings.nonexistentDays === 'hidden' ? 'cell--blank-hidden' : 'cell--blank-gray')
    return classes.join(' ')
  }
  const timing = getDayTiming(day.date, today)
  if (timing === 'today') classes.push('cell--today')
  if (timing === 'past' && settings.mutePastDays) classes.push('cell--past')
  return classes.join(' ')
}

export function SemesterGrid({ semester, settings, today, onWeekNumberChange, onWidthsChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  // Пока тянем границу, ширина меняется на экране, а сохраняется один раз в конце
  const [drag, setDrag] = useState<Widths | null>(null)

  const widths: Widths = drag ?? { columns: semester.columnWidths, month: semester.monthColumnWidth }
  const months = buildCalendar(semester.startDate, semester.endDate)
  const weekOne = resolveWeekOneMonday(semester)
  const todayDay = months.some((m) => m.days.some((d) => d.date === today))
    ? parseIsoDate(today).day
    : null

  function startResize(event: PointerEvent, target: 'month' | number) {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const base: Widths = { columns: [...semester.columnWidths], month: semester.monthColumnWidth }
    const startWidth = target === 'month' ? base.month : (base.columns[target] ?? DEFAULT_COLUMN_WIDTH)
    let last = base

    const widthsAt = (clientX: number): Widths => {
      const raw = startWidth + clientX - startX
      if (target === 'month') return { ...base, month: clampMonthColumnWidth(raw) }
      const columns = [...base.columns]
      columns[target] = clampColumnWidth(raw)
      return { ...base, columns }
    }
    const move = (e: globalThis.PointerEvent) => {
      last = widthsAt(e.clientX)
      setDrag(last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      onWidthsChange(last.columns, last.month)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function fitToWindow() {
    const available = scrollRef.current?.clientWidth ?? 0
    const width = fitColumnWidth(available - 2, semester.monthColumnWidth)
    onWidthsChange(Array<number>(DAYS_IN_ROW).fill(width), semester.monthColumnWidth)
  }

  function resetWidths() {
    onWidthsChange(Array<number>(DAYS_IN_ROW).fill(DEFAULT_COLUMN_WIDTH), DEFAULT_MONTH_COLUMN_WIDTH)
  }

  const gridStyle: CSSProperties = {
    gridTemplateColumns: [widths.month, ...widths.columns].map((w) => `${w}px`).join(' '),
  }

  return (
    <div>
      <div className="grid-toolbar">
        <button type="button" onClick={fitToWindow}>
          {ru.grid.fitWidth}
        </button>
        <button type="button" onClick={resetWidths}>
          {ru.grid.resetWidth}
        </button>
      </div>
      <div className="grid-scroll" role="region" aria-label={ru.grid.label} ref={scrollRef}>
        <div className="grid" style={gridStyle}>
          <div className="head head--corner" style={{ gridRow: 1, gridColumn: 1 }}>
            <div
              className="resize-handle"
              role="separator"
              aria-label={ru.grid.resizeColumn}
              data-testid="resize-month"
              onPointerDown={(e) => startResize(e, 'month')}
            />
          </div>
          {Array.from({ length: DAYS_IN_ROW }, (_, i) => i + 1).map((day) => (
            <div
              key={day}
              className={day === todayDay ? 'head head--today' : 'head'}
              style={{ gridRow: 1, gridColumn: day + 1 }}
              data-testid={`head-${day}`}
            >
              {day}
              <div
                className="resize-handle"
                role="separator"
                aria-label={ru.grid.resizeColumn}
                data-testid={`resize-${day}`}
                onPointerDown={(e) => startResize(e, day - 1)}
              />
            </div>
          ))}

          {months.map((month, index) => {
            // Как в таблице: строка дней недели стоит над строками своего месяца
            const weekdayRow = 2 + index * 2
            const eventRow = weekdayRow + 1
            const fill = settings.monthColors[month.month - 1] ?? '#dddddd'
            const monthStyle: CSSProperties = {
              gridRow: eventRow,
              gridColumn: 1,
              background: fill,
              color: contrastText(fill),
            }
            return [
              <div
                key={`${month.key}-gap`}
                className="month-gap"
                style={{ gridRow: weekdayRow, gridColumn: 1 }}
              />,
              <div
                key={`${month.key}-label`}
                className="month"
                style={monthStyle}
                data-testid={`month-${month.key}`}
              >
                {ru.months[month.month - 1]}
              </div>,
              ...month.days.map((day) => {
                const shown = day.date !== null && day.status === 'normal' && day.weekday !== null
                return (
                  <div
                    key={`${month.key}-weekday-${day.day}`}
                    className={`${cellClasses(day, today, settings)} cell--weekday`}
                    style={{
                      gridRow: weekdayRow,
                      gridColumn: day.day + 1,
                      ...(shown && day.weekday !== null
                        ? { background: weekdayColor(day.weekday, settings.weekGradient) }
                        : {}),
                    }}
                    data-testid={`weekday-${month.key}-${day.day}`}
                  >
                    {shown && day.weekday !== null ? ru.weekdaysShort[day.weekday] : ''}
                  </div>
                )
              }),
              ...month.days.map((day) => {
                const isMonday = day.date !== null && day.status === 'normal' && day.weekday === 0
                return (
                  <div
                    key={`${month.key}-event-${day.day}`}
                    className={`${cellClasses(day, today, settings)} cell--lane`}
                    style={{ gridRow: eventRow, gridColumn: day.day + 1 }}
                    data-testid={`cell-${month.key}-${day.day}`}
                  >
                    {isMonday && day.date !== null && (
                      <WeekNumber
                        date={day.date}
                        number={weekNumber(day.date, weekOne)}
                        onChange={onWeekNumberChange}
                      />
                    )}
                  </div>
                )
              }),
            ]
          })}
        </div>
      </div>
    </div>
  )
}
