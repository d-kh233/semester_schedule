import { useState } from 'react'
import type { Semester } from '../../core/model'
import { ru } from '../../i18n/ru'

interface Props {
  // Расписания, которые можно выгрузить (демо не выгружается)
  semesters: Semester[]
  // Выбрано по умолчанию: открытое расписание
  defaultId: string
  onExport: (scheduleIds: string[], includeService: boolean) => void
}

export function ExportControls({ semesters, defaultId, onExport }: Props) {
  const choices = semesters.filter((s) => !s.isDemo)
  const [selected, setSelected] = useState<string[]>([defaultId])
  const [includeService, setIncludeService] = useState(true)
  const canExport = selected.length > 0 || includeService

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )

  return (
    <div>
      <p>{ru.excel.exportHint}</p>
      <fieldset>
        <legend>{ru.excel.scheduleListTitle}</legend>
        {choices.map((s) => (
          <label key={s.id} style={{ display: 'block' }}>
            <input
              type="checkbox"
              checked={selected.includes(s.id)}
              onChange={() => toggle(s.id)}
            />{' '}
            {s.name}
          </label>
        ))}
        <label style={{ display: 'block' }}>
          <input
            type="checkbox"
            checked={includeService}
            onChange={(e) => setIncludeService(e.target.checked)}
          />{' '}
          {ru.excel.includeService}
        </label>
      </fieldset>
      {!canExport && <p>{ru.excel.exportNeedOne}</p>}
      <button
        type="button"
        className="btn"
        disabled={!canExport}
        onClick={() => onExport(selected, includeService)}
      >
        {ru.excel.exportButton}
      </button>
    </div>
  )
}
