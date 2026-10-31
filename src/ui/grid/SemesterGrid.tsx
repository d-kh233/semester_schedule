import { useMemo, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react'
import { buildCalendar, getDayTiming, weekNumber, type CalendarDay } from '../../core/calendar'
import type { EventType, ImportanceLevel, Subject } from '../../core/catalog'
import { contrastText, weekdayColor, weekdayTextColor } from '../../core/colors'
import { toggleHiddenMonth, visibleMonths } from '../../core/hiddenMonths'
import { DEFAULT_CROWDED_DAYS } from '../../core/crowded'
import { parseIsoDate, type IsoDate } from '../../core/dates'
import type { EventRecord } from '../../core/events'
import { buildMonthLayouts } from '../../core/gridBlocks'
import {
  DAYS_IN_ROW,
  DEFAULT_COLUMN_WIDTH,
  clampColumnWidth,
  clampMonthColumnWidth,
  resolveWeekOneMonday,
  type Semester,
} from '../../core/model'
import type { Settings } from '../../core/settings'
import { ru } from '../../i18n/ru'
import { CellInput } from '../input/CellInput'
import type { InputEngine } from '../input/useInputEngine'
import { EventBlock } from './EventBlock'
import { WeekNumber } from './WeekNumber'
import './grid.css'

interface Props {
  semester: Semester
  settings: Settings
  today: IsoDate
  // События этого расписания, у которых уже есть дорожки
  events: EventRecord[]
  types: EventType[]
  levels: ImportanceLevel[]
  subjects: Subject[]
  // Прокручиваемая область: нужна верхней панели, чтобы вписать ширину в окно
  scrollRef: RefObject<HTMLDivElement | null>
  onWeekNumberChange: (monday: IsoDate, number: number) => void
  onWidthsChange: (columnWidths: number[], monthColumnWidth: number) => void
  onHiddenMonthsChange: (hiddenMonths: string[]) => void
  // Быстрый ввод в ячейке (щелчок по пустой ячейке)
  engine: InputEngine
  onEventOpen: (eventId: string) => void
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

export function SemesterGrid({
  semester,
  settings,
  today,
  events,
  types,
  levels,
  subjects,
  scrollRef,
  onWeekNumberChange,
  onWidthsChange,
  onHiddenMonthsChange,
  engine,
  onEventOpen,
}: Props) {
  // Пока тянем границу, ширина меняется на экране, а сохраняется один раз в конце
  const [drag, setDrag] = useState<Widths | null>(null)
  // Ячейка с открытым полем ввода: ключ однозначно задаёт строку и день
  const [editing, setEditing] = useState<{ key: string; date: IsoDate } | null>(null)

  const widths: Widths = drag ?? { columns: semester.columnWidths, month: semester.monthColumnWidth }
  const allMonths = useMemo(
    () => buildCalendar(semester.startDate, semester.endDate),
    [semester.startDate, semester.endDate],
  )
  // Раскладка считается по всем месяцам, чтобы скрытие не меняло дорожки; рисуются только видимые
  const allLayouts = useMemo(
    () =>
      buildMonthLayouts({
        months: allMonths,
        events,
        types,
        levels,
        subjects,
        today,
        crowdedDays: DEFAULT_CROWDED_DAYS,
      }),
    [allMonths, events, types, levels, subjects, today],
  )
  const months = visibleMonths(allMonths, semester.hiddenMonths)
  const layouts = allLayouts.filter((_, i) => !semester.hiddenMonths.includes(allMonths[i]?.key ?? ''))
  // Первая строка сетки каждого месяца: строка дней недели, затем строки событий
  const monthStarts: number[] = []
  let nextRow = 2
  for (const layout of layouts) {
    monthStarts.push(nextRow)
    nextRow += 1 + layout.rows
  }
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

  const gridStyle: CSSProperties = {
    gridTemplateColumns: [widths.month, ...widths.columns].map((w) => `${w}px`).join(' '),
  }

  return (
    <div className="grid-wrap">
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
            const weekdayRow = monthStarts[index] ?? 2
            const eventRow = weekdayRow + 1
            const layout = layouts[index]
            const rows = layout?.rows ?? 1
            const fill = settings.monthColors[month.month - 1] ?? '#dddddd'
            const monthStyle: CSSProperties = {
              gridRow: `${eventRow} / span ${rows}`,
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
                <button
                  type="button"
                  className="month__hide"
                  aria-label={`${ru.grid.hideMonth}: ${ru.months[month.month - 1] ?? ''}`}
                  title={ru.grid.hideMonth}
                  data-testid={`hide-${month.key}`}
                  onClick={() =>
                    onHiddenMonthsChange(toggleHiddenMonth(semester.hiddenMonths, month.key))
                  }
                />
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
                        ? {
                            background: weekdayColor(day.weekday, settings.weekGradient),
                            color: weekdayTextColor(day.weekday, settings.weekGradient),
                          }
                        : {}),
                    }}
                    data-testid={`weekday-${month.key}-${day.day}`}
                  >
                    {shown && day.weekday !== null ? ru.weekdaysShort[day.weekday] : ''}
                  </div>
                )
              }),
              ...Array.from({ length: rows }, (_, lane) =>
                month.days.map((day) => {
                  // Номер недели стоит только в первой строке месяца
                  const isMonday =
                    lane === 0 && day.date !== null && day.status === 'normal' && day.weekday === 0
                  const lastLane = lane === rows - 1
                  const cellKey = `${month.key}-${day.day}-${lane}`
                  const cellDate = day.date !== null && day.status === 'normal' ? day.date : null
                  return (
                    <div
                      key={`${month.key}-event-${lane}-${day.day}`}
                      className={`${cellClasses(day, today, settings)} cell--lane${lastLane ? '' : ' cell--lane-inner'}`}
                      style={{ gridRow: eventRow + lane, gridColumn: day.day + 1 }}
                      data-testid={
                        lane === 0
                          ? `cell-${month.key}-${day.day}`
                          : `cell-${month.key}-${day.day}-r${lane}`
                      }
                      onClick={(e) => {
                        // Клик по номеру недели правит номер, а не открывает ввод
                        if (cellDate !== null && !(e.target as HTMLElement).closest('.weeknum')) {
                          setEditing({ key: cellKey, date: cellDate })
                        }
                      }}
                    >
                      {editing?.key === cellKey && cellDate !== null && (
                        <CellInput
                          date={cellDate}
                          engine={engine}
                          alignRight={day.day > 20}
                          onClose={() => setEditing(null)}
                        />
                      )}
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
              ).flat(),
              ...(layout?.blocks ?? []).map((block) => (
                <EventBlock
                  key={`${month.key}-${block.key}`}
                  block={block}
                  monthKey={month.key}
                  firstRow={eventRow}
                  mutePast={settings.mutePastDays}
                  onOpen={onEventOpen}
                />
              )),
            ]
          })}
        </div>
      </div>
    </div>
  )
}
