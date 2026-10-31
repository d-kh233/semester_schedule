import { useRef, useState } from 'react'
import type { useAppData } from '../../app/useAppData'
import { buildCalendar, weekOneMondayFor } from '../../core/calendar'
import { countHiddenMonths } from '../../core/hiddenMonths'
import type { IsoDate } from '../../core/dates'
import {
  DAYS_IN_ROW,
  DEFAULT_COLUMN_WIDTH,
  DEFAULT_MONTH_COLUMN_WIDTH,
  fitColumnWidth,
  type Semester,
} from '../../core/model'
import { paintLevels, resolvePalette } from '../../core/schedulePalette'
import { DeadlinesPage } from '../events/DeadlinesPage'
import { EventCard } from '../events/EventCard'
import { EventList } from '../events/EventList'
import { SemesterGrid } from '../grid/SemesterGrid'
import { QuickInput } from '../input/QuickInput'
import { useInputEngine } from '../input/useInputEngine'
import { SettingsDialog } from '../settings/SettingsDialog'
import { TopBar, type View } from './TopBar'

type AppData = ReturnType<typeof useAppData>

// Какая карточка открыта: новое событие (с датой или без) или существующее
type CardState = { eventId: string | null; date: IsoDate | null } | null

interface Props {
  data: AppData
  active: Semester
  today: IsoDate
  view: View
  onViewChange: (view: View) => void
  // Окно «Настройки» живёт выше: при создании расписания рабочая область пересоздаётся
  settingsOpen: boolean
  onSettingsOpenChange: (open: boolean) => void
}

// Всё, что зависит от открытого расписания; при смене расписания создаётся заново
export function Workspace({
  data,
  active,
  today,
  view,
  onViewChange,
  settingsOpen,
  onSettingsOpenChange,
}: Props) {
  const [card, setCard] = useState<CardState>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Палитра у каждого расписания своя; пока её нет, действуют общие цвета
  const palette = resolvePalette(active.palette, data.settings, data.levels)
  const viewSettings = {
    ...data.settings,
    weekGradient: palette.weekGradient,
    monthColors: palette.monthColors,
  }
  const viewLevels = paintLevels(data.levels, palette.levelColors)

  const events = data.events.filter((e) => e.semesterId === active.id)
  // Предметы демо не показываются в личном расписании, и наоборот
  const subjects = data.subjects.filter((s) => s.demo === active.isDemo)
  const cardEvent = card?.eventId ? (events.find((e) => e.id === card.eventId) ?? null) : null

  const engine = useInputEngine({
    today,
    semesterId: active.id,
    semesterStart: active.startDate,
    semesterEnd: active.endDate,
    levels: data.levels,
    types: data.types,
    subjects,
    events,
    onApply: data.applyEventChanges,
    onRevert: data.revertEventChanges,
    onAddSubject: (name, shortName) => data.addSubject(name, shortName, active.isDemo),
    onAddLevels: data.addImportanceLevels,
  })

  function fitToWindow() {
    const available = scrollRef.current?.clientWidth ?? 0
    const width = fitColumnWidth(available - 2, active.monthColumnWidth)
    data.updateSemester(active.id, { columnWidths: Array<number>(DAYS_IN_ROW).fill(width) })
  }

  function resetWidths() {
    data.updateSemester(active.id, {
      columnWidths: Array<number>(DAYS_IN_ROW).fill(DEFAULT_COLUMN_WIDTH),
      monthColumnWidth: DEFAULT_MONTH_COLUMN_WIDTH,
    })
  }

  return (
    <>
      <TopBar
        semesters={data.semesters}
        activeId={active.id}
        saveState={data.saveState}
        onSelect={data.setActive}
        onFit={fitToWindow}
        onResort={() => data.resortLanes(active.id)}
        hiddenCount={countHiddenMonths(
          buildCalendar(active.startDate, active.endDate),
          active.hiddenMonths,
        )}
        onShowAllMonths={() => data.updateSemester(active.id, { hiddenMonths: [] })}
        view={view}
        onViewChange={onViewChange}
        onOpenSettings={() => onSettingsOpenChange(true)}
      >
        <QuickInput engine={engine} />
      </TopBar>
      <div className="app__body">
        {/* Сетка остаётся на месте и на вкладке списка: так не теряется прокрутка */}
        <div className="app__view" hidden={view !== 'grid'}>
          <SemesterGrid
            semester={active}
            settings={viewSettings}
            today={today}
            events={events}
            types={data.types}
            levels={viewLevels}
            subjects={subjects}
            scrollRef={scrollRef}
            engine={engine}
            onEventOpen={(id) => setCard({ eventId: id, date: null })}
            onWeekNumberChange={(monday, number) =>
              data.updateSemester(active.id, { weekOneMonday: weekOneMondayFor(monday, number) })
            }
            onHiddenMonthsChange={(hiddenMonths) =>
              data.updateSemester(active.id, { hiddenMonths })
            }
            onWidthsChange={(columnWidths, monthColumnWidth) =>
              data.updateSemester(active.id, { columnWidths, monthColumnWidth })
            }
          />
        </div>
        {view === 'list' && (
          <DeadlinesPage>
            <EventList
              events={events}
              types={data.types}
              levels={viewLevels}
              subjects={subjects}
              onAdd={() => setCard({ eventId: null, date: null })}
              onOpen={(id) => setCard({ eventId: id, date: null })}
              onRestore={(id) => data.setEventArchived(id, false)}
            />
          </DeadlinesPage>
        )}
      </div>
      {settingsOpen && (
        <SettingsDialog
          semesters={data.semesters}
          active={active}
          settings={data.settings}
          palette={palette}
          levelCount={data.levels.length}
          onDatesChange={(startDate, endDate) =>
            data.updateSemester(active.id, { startDate, endDate })
          }
          onSettingsChange={data.updateSettings}
          onPaletteChange={(next) => data.updateSemester(active.id, { palette: next })}
          onResetWidths={resetWidths}
          onCreate={data.addSchedule}
          onRename={(id, name) => data.updateSemester(id, { name })}
          onArchive={data.archiveSchedule}
          onRestore={data.restoreSchedule}
          onClose={() => onSettingsOpenChange(false)}
        />
      )}
      {card && (card.eventId === null || cardEvent) && (
        <EventCard
          key={card.eventId ?? `new-${card.date ?? ''}`}
          event={cardEvent}
          defaultDate={card.date}
          types={data.types}
          levels={viewLevels}
          subjects={subjects}
          onSave={(fields) => data.saveEvent(cardEvent, fields, active.id)}
          onAddSubject={(name, shortName) => data.addSubject(name, shortName, active.isDemo)}
          onArchive={() => cardEvent && data.setEventArchived(cardEvent.id, true)}
          onDelete={() => cardEvent && data.deleteEvent(cardEvent.id)}
          onClose={() => setCard(null)}
        />
      )}
    </>
  )
}
