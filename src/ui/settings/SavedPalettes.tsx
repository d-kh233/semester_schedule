import { useState } from 'react'
import type { PaletteVariant } from '../../core/autoPalette'
import {
  validatePaletteName,
  type SavedPalette,
  type SchedulePalette,
} from '../../core/schedulePalette'
import { ru } from '../../i18n/ru'
import { PalettePreview } from './AutoPalette'

interface Props {
  saved: SavedPalette[]
  // Палитра открытого расписания: её можно сохранить
  current: SchedulePalette
  onSave: (name: string, palette: SchedulePalette) => void
  onApply: (palette: PaletteVariant) => void
  onDelete: (id: string) => void
}

export function SavedPalettes({ saved, current, onSave, onApply, onDelete }: Props) {
  const [name, setName] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function save() {
    const problem = validatePaletteName(name, saved)
    if (problem) {
      setError(ru.palette.saved.errors[problem])
      return
    }
    onSave(name.trim(), current)
    setName('')
    setError(null)
  }

  return (
    <div className="auto-palette" data-testid="saved-palettes">
      <h4>{ru.palette.saved.title}</h4>
      <p className="auto-palette__hint">{ru.palette.saved.hint}</p>
      <div className="auto-palette__bases">
        <input
          type="text"
          value={name}
          placeholder={ru.palette.saved.namePlaceholder}
          aria-label={ru.palette.saved.nameLabel}
          data-testid="saved-name"
          maxLength={60}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <button type="button" className="btn" data-testid="saved-save" onClick={save}>
          {ru.palette.saved.save}
        </button>
      </div>
      {error && (
        <p className="controls__error" role="alert">
          {error}
        </p>
      )}
      {saved.length === 0 && <p className="auto-palette__hint">{ru.palette.saved.empty}</p>}
      <div className="auto-palette__variants">
        {saved.map((item) => (
          <div key={item.id} className="auto-palette__variant" data-testid={`saved-${item.name}`}>
            <strong>{item.name}</strong>
            <PalettePreview variant={item.palette} />
            {confirmId === item.id ? (
              <div className="auto-palette__bases">
                <span>{ru.palette.saved.confirmDelete(item.name)}</span>
                <button
                  type="button"
                  className="btn btn--danger"
                  data-testid="saved-delete-yes"
                  onClick={() => {
                    onDelete(item.id)
                    setConfirmId(null)
                  }}
                >
                  {ru.palette.saved.yes}
                </button>
                <button type="button" className="btn" onClick={() => setConfirmId(null)}>
                  {ru.palette.saved.no}
                </button>
              </div>
            ) : (
              <div className="auto-palette__bases">
                <button
                  type="button"
                  className="btn btn--primary"
                  data-testid="saved-apply"
                  onClick={() => onApply(item.palette)}
                >
                  {ru.palette.saved.apply}
                </button>
                <button
                  type="button"
                  className="btn btn--danger"
                  data-testid="saved-delete"
                  onClick={() => setConfirmId(item.id)}
                >
                  {ru.palette.saved.delete}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
