import { useEffect, useState } from 'react'
import { todayIso } from './app/today'
import { useAppData } from './app/useAppData'
import { weekOneMondayFor } from './core/calendar'
import { ru } from './i18n/ru'
import { SemesterGrid } from './ui/grid/SemesterGrid'
import { ScheduleBar } from './ui/schedules/ScheduleBar'
import { ScheduleManager } from './ui/schedules/ScheduleManager'
import { PaletteControls } from './ui/settings/PaletteControls'
import { SemesterControls } from './ui/settings/SemesterControls'

export function App() {
  const data = useAppData()
  const [today, setToday] = useState(todayIso)

  // Если страница простояла открытой до следующего дня, «сегодня» обновляется при возврате к ней
  useEffect(() => {
    const refresh = () => setToday(todayIso())
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  const { active } = data

  return (
    <main>
      <h1>{ru.appTitle}</h1>
      {!data.ready || !active ? (
        <p>{ru.loading}</p>
      ) : (
        <>
          <ScheduleBar
            semesters={data.semesters}
            activeId={active.id}
            saveState={data.saveState}
            onSelect={data.setActive}
          />
          <ScheduleManager
            semesters={data.semesters}
            onCreate={data.addSchedule}
            onRename={(id, name) => data.updateSemester(id, { name })}
            onArchive={data.archiveSchedule}
            onRestore={data.restoreSchedule}
          />
          <SemesterControls
            key={active.id}
            semester={active}
            settings={data.settings}
            onDatesChange={(startDate, endDate) =>
              data.updateSemester(active.id, { startDate, endDate })
            }
            onSettingsChange={data.updateSettings}
          />
          <PaletteControls settings={data.settings} onSettingsChange={data.updateSettings} />
          <SemesterGrid
            semester={active}
            settings={data.settings}
            today={today}
            onWeekNumberChange={(monday, number) =>
              data.updateSemester(active.id, { weekOneMonday: weekOneMondayFor(monday, number) })
            }
            onWidthsChange={(columnWidths, monthColumnWidth) =>
              data.updateSemester(active.id, { columnWidths, monthColumnWidth })
            }
          />
        </>
      )}
    </main>
  )
}
