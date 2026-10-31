import type { CSSProperties } from 'react'
import { buildCalendar, getDayTiming, type CalendarDay } from '../../core/calendar'
import { weekdayColor } from '../../core/colors'
import { parseIsoDate, type IsoDate } from '../../core/dates'
import type { Settings } from '../../core/settings'
import { ru } from '../../i18n/ru'
import './grid.css'

interface Props {
  settings: Settings
  today: IsoDate
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

export function SemesterGrid({ settings, today }: Props) {
  const months = buildCalendar(settings.semesterStart, settings.semesterEnd)
  const todayDay = months.some((m) => m.days.some((d) => d.date === today))
    ? parseIsoDate(today).day
    : null

  return (
    <div className="grid-scroll" role="region" aria-label={ru.grid.label}>
      <div className="grid">
        <div className="head head--corner" style={{ gridRow: 1, gridColumn: 1 }} />
        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
          <div
            key={day}
            className={day === todayDay ? 'head head--today' : 'head'}
            style={{ gridRow: 1, gridColumn: day + 1 }}
            data-testid={`head-${day}`}
          >
            {day}
          </div>
        ))}

        {months.map((month, index) => {
          const eventRow = 2 + index * 2
          const weekdayRow = eventRow + 1
          const monthStyle: CSSProperties = {
            gridRow: `${eventRow} / span 2`,
            gridColumn: 1,
            background: settings.monthColors[month.month - 1],
          }
          return [
            <div key={`${month.key}-label`} className="month" style={monthStyle} data-testid={`month-${month.key}`}>
              <span className="month__name">{ru.months[month.month - 1]}</span>
              <span className="month__year">{month.year}</span>
            </div>,
            ...month.days.map((day) => (
              <div
                key={`${month.key}-event-${day.day}`}
                className={cellClasses(day, today, settings)}
                style={{ gridRow: eventRow, gridColumn: day.day + 1 }}
                data-testid={`cell-${month.key}-${day.day}`}
              />
            )),
            ...month.days.map((day) => {
              const colored = day.date !== null && day.status === 'normal' && day.weekday !== null
              const style: CSSProperties = { gridRow: weekdayRow, gridColumn: day.day + 1 }
              if (colored && day.weekday !== null) {
                style.background = weekdayColor(day.weekday, settings.weekGradient)
              }
              return (
                <div
                  key={`${month.key}-weekday-${day.day}`}
                  className={`${cellClasses(day, today, settings)} cell--weekday`}
                  style={style}
                  data-testid={`weekday-${month.key}-${day.day}`}
                >
                  {colored && day.weekday !== null ? ru.weekdaysShort[day.weekday] : ''}
                </div>
              )
            }),
          ]
        })}
      </div>
    </div>
  )
}
