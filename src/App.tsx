import { useEffect, useRef, useState } from 'react'
import { todayIso } from './app/today'
import { useAppData } from './app/useAppData'
import { weekOneMondayFor } from './core/calendar'
import type { IsoDate } from './core/dates'
import {
  DAYS_IN_ROW,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_MONTH_COLUMN_WIDTH,
  fitColumnWidth,
} from './core/model'
import { ru } from './i18n/ru'
import { DeadlinesPanel } from './ui/events/DeadlinesPanel'
import { EventCard } from './ui/events/EventCard'
import { EventList } from './ui/events/EventList'
import { SemesterGrid } from './ui/grid/SemesterGrid'
import { QuickInput } from './ui/input/QuickInput'
import { TopBar } from './ui/layout/TopBar'
import { SettingsDialog } from './ui/settings/SettingsDialog'

// Какая карточка открыта: новое событие (с датой или без) или существующее
type CardState = { eventId: string | null; date: IsoDate | null } | null

export function App() {
  const data = useAppData()
  const [today, setToday] = useState(todayIso)
  const [card, setCard] = useState<CardState>(null)
  const [listOpen, setListOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

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

  function fitToWindow() {
    if (!active) return
    const available = scrollRef.current?.clientWidth ?? 0
    const width = fitColumnWidth(available - 2, active.monthColumnWidth)
    data.updateSemester(active.id, { columnWidths: Array<number>(DAYS_IN_ROW).fill(width) })
  }

  function resetWidths() {
    if (!active) return
    data.updateSemester(active.id, {
      columnWidths: Array<number>(DAYS_IN_ROW).fill(DEFAULT_COLUMN_WIDTH),
      monthColumnWidth: DEFAULT_MONTH_COLUMN_WIDTH,
    })
  }

  if (!data.ready || !active) {
    return (
      <main className="app">
        <p>{ru.loading}</p>
      </main>
    )
  }

  return (
    <main className="app">
      <TopBar
        semesters={data.semesters}
        activeId={active.id}
        saveState={data.saveState}
        onSelect={data.setActive}
        onFit={fitToWindow}
        onResort={() => data.resortLanes(active.id)}
        deadlinesOpen={listOpen}
        onToggleDeadlines={() => setListOpen((open) => !open)}
        onOpenSettings={() => setSettingsOpen(true)}
      >
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
      </TopBar>
      <div className="app__body">
        <SemesterGrid
          semester={active}
          settings={data.settings}
          today={today}
          events={events}
          types={data.types}
          levels={data.levels}
          subjects={subjects}
          scrollRef={scrollRef}
          onEventOpen={(id) => setCard({ eventId: id, date: null })}
          onWeekNumberChange={(monday, number) =>
            data.updateSemester(active.id, { weekOneMonday: weekOneMondayFor(monday, number) })
          }
          onWidthsChange={(columnWidths, monthColumnWidth) =>
            data.updateSemester(active.id, { columnWidths, monthColumnWidth })
          }
          onCellDoubleClick={(date) => setCard({ eventId: null, date })}
        />
        {listOpen && (
          <DeadlinesPanel onClose={() => setListOpen(false)}>
            <EventList
              events={events}
              types={data.types}
              levels={data.levels}
              subjects={subjects}
              onAdd={() => setCard({ eventId: null, date: null })}
              onOpen={(id) => setCard({ eventId: id, date: null })}
              onRestore={(id) => data.setEventArchived(id, false)}
            />
          </DeadlinesPanel>
        )}
      </div>
      {settingsOpen && (
        <SettingsDialog
          semesters={data.semesters}
          active={active}
          settings={data.settings}
          onDatesChange={(startDate, endDate) =>
            data.updateSemester(active.id, { startDate, endDate })
          }
          onSettingsChange={data.updateSettings}
          onResetWidths={resetWidths}
          onCreate={data.addSchedule}
          onRename={(id, name) => data.updateSemester(id, { name })}
          onArchive={data.archiveSchedule}
          onRestore={data.restoreSchedule}
          onClose={() => setSettingsOpen(false)}
        />
      )}
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
    </main>
  )
}
