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
import { withAlpha } from '../../core/colors'
import { ru } from '../../i18n/ru'
import { paintLevels, resolvePalette } from '../../core/schedulePalette'
import { DeadlinesPage } from '../events/DeadlinesPage'
import { EventCard } from '../events/EventCard'
import { EventList } from '../events/EventList'
import { SemesterGrid } from '../grid/SemesterGrid'
import { ImportDialog } from '../import/ImportDialog'
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
  const [importOpen, setImportOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Палитра у каждого расписания своя; пока её нет, действуют общие цвета
  const palette = resolvePalette(active.palette, data.settings, data.levels)
  const viewSettings = {
    ...data.settings,
    weekGradient: palette.weekGradient,
    monthColors: palette.monthColors,
    todayColor: palette.todayColor,
  }
  const viewLevels = paintLevels(data.levels, palette.levelColors)

  // Выгрузка всех данных в Excel (календари и служебные листы). Библиотека Excel грузится только здесь.
  const exportExcel = async (scheduleIds: string[], includeService: boolean) => {
    try {
      const { buildExportWorkbook } = await import('../../excel/exportXlsx')
      const { downloadWorkbook } = await import('../../excel/download')
      const exportedAt = new Date().toISOString()
      const workbook = buildExportWorkbook({
        semesters: data.semesters,
        events: data.events,
        types: data.types,
        levels: data.levels,
        subjects: data.subjects,
        settings: data.settings,
        scheduleIds,
        includeService,
        exportedAt,
      })
      await downloadWorkbook(workbook, `расписание-${exportedAt.slice(0, 10)}.xlsx`)
    } catch {
      window.alert(ru.excel.exportError)
    }
  }

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
            pastTextColor={withAlpha(palette.weekGradient.dark, palette.pastTextOpacity)}
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
              onImport={() => setImportOpen(true)}
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
          levels={data.levels}
          types={data.types}
          catalog={{
            onAddType: data.addType,
            onUpdateType: data.updateType,
            onDeleteType: data.deleteType,
            onRenameLevel: data.renameLevel,
            onDeleteLevel: data.deleteLevel,
            onAddLevel: data.addImportanceLevels,
          }}
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
          onExport={exportExcel}
          onClose={() => onSettingsOpenChange(false)}
        />
      )}
      {importOpen && (
        <ImportDialog
          semesterId={active.id}
          today={today}
          semesterStart={active.startDate}
          semesterEnd={active.endDate}
          levels={data.levels}
          types={data.types}
          subjects={subjects}
          events={events}
          onApply={data.applyEventChanges}
          onRevert={data.revertEventChanges}
          onAddSubject={(name, shortName) => data.addSubject(name, shortName, active.isDemo)}
          onClose={() => setImportOpen(false)}
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
