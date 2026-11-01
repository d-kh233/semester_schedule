import type { Semester } from '../../core/model'
import type { EventType, ImportanceLevel } from '../../core/catalog'
import type { DeleteBlock } from '../../core/catalogRules'
import type { TypeFields } from '../../app/useAppData'
import type { SchedulePalette } from '../../core/schedulePalette'
import type { Settings } from '../../core/settings'
import { ru } from '../../i18n/ru'
import { Modal } from '../common/Modal'
import { ScheduleManager } from '../schedules/ScheduleManager'
import { CatalogControls } from './CatalogControls'
import { ExportControls } from './ExportControls'
import { PaletteControls } from './PaletteControls'
import { SemesterControls } from './SemesterControls'

interface Props {
  semesters: Semester[]
  active: Semester
  settings: Settings
  palette: SchedulePalette
  levels: ImportanceLevel[]
  types: EventType[]
  catalog: {
    onAddType: (fields: TypeFields) => void
    onUpdateType: (id: string, patch: Partial<TypeFields>) => void
    onDeleteType: (id: string) => DeleteBlock
    onRenameLevel: (id: string, name: string) => void
    onDeleteLevel: (id: string) => DeleteBlock
    onAddLevel: (upTo: number) => number
  }
  onDatesChange: (start: string, end: string) => void
  onSettingsChange: (patch: Partial<Settings>) => void
  onPaletteChange: (palette: SchedulePalette) => void
  onResetWidths: () => void
  onCreate: (name: string, startDate: string, endDate: string) => void
  onRename: (id: string, name: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onExport: (scheduleIds: string[], includeService: boolean) => void
  onClose: () => void
}

export function SettingsDialog(props: Props) {
  const { active } = props
  return (
    <Modal title={ru.settings.title} closeLabel={ru.settings.close} wide onClose={props.onClose}>
      <ExportControls
        semesters={props.semesters}
        defaultId={active.id}
        onExport={props.onExport}
      />
      <h3>{ru.settings.semesterTitle}</h3>
      <SemesterControls
        key={`controls-${active.id}`}
        semester={active}
        settings={props.settings}
        onDatesChange={props.onDatesChange}
        onSettingsChange={props.onSettingsChange}
      />
      <button type="button" className="btn" onClick={props.onResetWidths}>
        {ru.grid.resetWidth}
      </button>
      <PaletteControls
        settings={props.settings}
        scheduleName={active.name}
        palette={props.palette}
        levels={props.levels}
        onSettingsChange={props.onSettingsChange}
        onPaletteChange={props.onPaletteChange}
      />
      <h3>{ru.catalog.title}</h3>
      <CatalogControls types={props.types} levels={props.levels} {...props.catalog} />
      <h3>{ru.settings.schedulesTitle}</h3>
      <ScheduleManager
        semesters={props.semesters}
        onCreate={props.onCreate}
        onRename={props.onRename}
        onArchive={props.onArchive}
        onRestore={props.onRestore}
      />
    </Modal>
  )
}
