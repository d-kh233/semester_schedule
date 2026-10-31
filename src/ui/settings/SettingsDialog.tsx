import type { Semester } from '../../core/model'
import type { Settings } from '../../core/settings'
import { ru } from '../../i18n/ru'
import { Modal } from '../common/Modal'
import { ScheduleManager } from '../schedules/ScheduleManager'
import { PaletteControls } from './PaletteControls'
import { SemesterControls } from './SemesterControls'

interface Props {
  semesters: Semester[]
  active: Semester
  settings: Settings
  onDatesChange: (start: string, end: string) => void
  onSettingsChange: (patch: Partial<Settings>) => void
  onResetWidths: () => void
  onCreate: (name: string, startDate: string, endDate: string) => void
  onRename: (id: string, name: string) => void
  onArchive: (id: string) => void
  onRestore: (id: string) => void
  onClose: () => void
}

export function SettingsDialog(props: Props) {
  const { active } = props
  return (
    <Modal title={ru.settings.title} closeLabel={ru.settings.close} wide onClose={props.onClose}>
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
      <PaletteControls settings={props.settings} onSettingsChange={props.onSettingsChange} />
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
