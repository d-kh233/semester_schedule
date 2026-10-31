import type { CSSProperties } from 'react'
import { buildCalendar, getDayTiming, weekNumber, type CalendarDay } from '../../core/calendar'
import { contrastText, weekdayColor } from '../../core/colors'
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
            <div key={`${month.key}-label`} className="month" style={monthStyle} data-testid={`month-${month.key}`}>
              {ru.months[month.month - 1]}
            </div>,
            ...month.days.map((day) => {
              return (
                <div
                  key={`${month.key}-weekday-${day.day}`}
                  className={`${cellClasses(day, today, settings)} cell--weekday`}
                  style={{
                    gridRow: weekdayRow,
                    gridColumn: day.day + 1,
                    ...(day.date !== null && day.status === 'normal' && day.weekday !== null
                      ? { background: weekdayColor(day.weekday, settings.weekGradient) }
                      : {}),
                  }}
                  data-testid={`weekday-${month.key}-${day.day}`}
                >
                  {day.date !== null && day.status === 'normal' && day.weekday !== null
                    ? ru.weekdaysShort[day.weekday]
                    : ''}
                </div>
              )
            }),
            ...month.days.map((day) => {
              const number =
                day.date !== null && day.status === 'normal' && day.weekday === 0
                  ? weekNumber(day.date, settings.semesterStart)
                  : null
              return (
                <div
                  key={`${month.key}-event-${day.day}`}
                  className={`${cellClasses(day, today, settings)} cell--lane`}
                  style={{ gridRow: eventRow, gridColumn: day.day + 1 }}
                  data-testid={`cell-${month.key}-${day.day}`}
                >
                  {number !== null && day.date !== null && (
                    <span className="weeknum" data-testid={`weeknum-${day.date}`}>
                      {number}
                    </span>
                  )}
                </div>
              )
            }),
          ]
        })}
      </div>
    </div>
  )
}
