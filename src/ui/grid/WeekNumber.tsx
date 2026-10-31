import { useRef, useState } from 'react'
import { MAX_WEEK_NUMBER } from '../../core/calendar'
import type { IsoDate } from '../../core/dates'
import { ru } from '../../i18n/ru'

interface Props {
  date: IsoDate
  number: number | null
  onChange: (date: IsoDate, number: number) => void
}

// Маленькая цифра в клетке понедельника. Нажать и ввести другое число: счёт недель
// меняется во всей таблице.
export function WeekNumber({ date, number, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  // Правка закончена (Enter, Esc): повторная потеря фокуса ничего не сохраняет
  const finished = useRef(false)

  function start() {
    setDraft(number === null ? '' : String(number))
    finished.current = false
    setEditing(true)
  }

  function commit() {
    if (finished.current) return
    finished.current = true
    setEditing(false)
    const value = Number(draft)
    if (draft.trim() !== '' && Number.isInteger(value) && value >= 1 && value <= MAX_WEEK_NUMBER) {
      if (value !== number) onChange(date, value)
    }
  }

  if (editing) {
    return (
      <input
        className="weeknum weeknum--input"
        type="number"
        min={1}
        max={MAX_WEEK_NUMBER}
        autoFocus
        aria-label={ru.grid.weekNumberEdit}
        data-testid="weeknum-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            finished.current = true
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <button
      type="button"
      className="weeknum"
      aria-label={ru.grid.weekNumberEdit}
      data-testid={`weeknum-${date}`}
      onClick={start}
    >
      {number ?? ''}
    </button>
  )
}
