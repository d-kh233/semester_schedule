import { useEffect, useState } from 'react'
import { todayIso } from './app/today'
import { useAppData } from './app/useAppData'
import { weekOneMondayFor } from './core/calendar'
import type { IsoDate } from './core/dates'
import { ru } from './i18n/ru'
import { EventCard } from './ui/events/EventCard'
import { EventList } from './ui/events/EventList'
import { SemesterGrid } from './ui/grid/SemesterGrid'
import { QuickInput } from './ui/input/QuickInput'
import { ScheduleBar } from './ui/schedules/ScheduleBar'
import { ScheduleManager } from './ui/schedules/ScheduleManager'
import { PaletteControls } from './ui/settings/PaletteControls'
import { SemesterControls } from './ui/settings/SemesterControls'

// Какая карточка открыта: новое событие (с датой или без) или существующее
type CardState = { eventId: string | null; date: IsoDate | null } | null

export function App() {
  const data = useAppData()
  const [today, setToday] = useState(todayIso)
  const [card, setCard] = useState<CardState>(null)

  // Если страница простояла открытой до следующего дня, «сегодня» обновляется при возврате к ней
  useEffect(() => {
    const refresh = () => setToday(todayIso())
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  const { active } = data
  const events = active ? data.events.filter((e) => e.semesterId === active.id) : []
  // Предметы демо не показываются в личном расписании, и наоборот
  const subjects = active ? data.subjects.filter((s) => s.demo === active.isDemo) : []
  const cardEvent = card?.eventId ? (events.find((e) => e.id === card.eventId) ?? null) : null

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
          <QuickInput
            key={`input-${active.id}`}
            today={today}
            semesterId={active.id}
            semesterStart={active.startDate}
            semesterEnd={active.endDate}
            levels={data.levels}
            types={data.types}
            subjects={subjects}
            events={events}
            onApply={data.applyEventChanges}
            onRevert={data.revertEventChanges}
            onAddSubject={(name, shortName) => data.addSubject(name, shortName, active.isDemo)}
            onAddLevels={data.addImportanceLevels}
          />
          <ScheduleManager
            semesters={data.semesters}
            onCreate={data.addSchedule}
            onRename={(id, name) => data.updateSemester(id, { name })}
            onArchive={data.archiveSchedule}
            onRestore={data.restoreSchedule}
          />
          <SemesterControls
            key={`controls-${active.id}`}
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
            onCellDoubleClick={(date) => setCard({ eventId: null, date })}
          />
          <EventList
            events={events}
            types={data.types}
            levels={data.levels}
            subjects={subjects}
            onAdd={() => setCard({ eventId: null, date: null })}
            onOpen={(id) => setCard({ eventId: id, date: null })}
            onRestore={(id) => data.setEventArchived(id, false)}
          />
          {card && (card.eventId === null || cardEvent) && (
            <EventCard
              key={card.eventId ?? `new-${card.date ?? ''}`}
              event={cardEvent}
              defaultDate={card.date}
              types={data.types}
              levels={data.levels}
              subjects={subjects}
              onSave={(fields) => data.saveEvent(cardEvent, fields, active.id)}
              onAddSubject={(name, shortName) => data.addSubject(name, shortName, active.isDemo)}
              onArchive={() => cardEvent && data.setEventArchived(cardEvent.id, true)}
              onDelete={() => cardEvent && data.deleteEvent(cardEvent.id)}
              onClose={() => setCard(null)}
            />
          )}
        </>
      )}
    </main>
  )
}
