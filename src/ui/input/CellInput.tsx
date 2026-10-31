import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { splitInput } from '../../core/parser/parse'
import { formatDateRu, type IsoDate } from '../../core/dates'
import { ru } from '../../i18n/ru'
import { IssueItem } from './IssueItem'
import type { InputEngine } from './useInputEngine'

interface Props {
  date: IsoDate
  engine: InputEngine
  onClose: () => void
  // Правый край сетки: окно раскрывается влево, чтобы не уйти за экран
  alignRight: boolean
}

const t = ru.input

// Быстрый ввод прямо в ячейке: текст разбирается как в строке ввода, дата всегда дата ячейки
export function CellInput({ date, engine, onClose, alignRight }: Props) {
  const [text, setText] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const mine = engine.issues.filter((i) => i.fixedDate === date)
  const { clearIssues } = engine

  useEffect(() => {
    ref.current?.querySelector('input')?.focus()
  }, [])
  // Закрытая ячейка не оставляет подсказок, которых уже никто не увидит
  useEffect(() => () => clearIssues(date), [clearIssues, date])

  function save() {
    if (splitInput(text).length === 0) return onClose()
    const left = engine.submit(text, date)
    if (left === '') onClose()
    else setText(left)
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      save()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  // Фокус ушёл за пределы окна: пустое закрываем, написанное сохраняем как Enter
  function onBlur(e: FocusEvent<HTMLDivElement>) {
    if (e.relatedTarget && ref.current?.contains(e.relatedTarget as Node)) return
    if (mine.length > 0) return
    save()
  }

  function removePart(part: string) {
    const parts = splitInput(text)
    const index = parts.indexOf(part)
    if (index >= 0) parts.splice(index, 1)
    const left = parts.join('; ')
    if (left === '') onClose()
    else setText(left)
  }

  return (
    <div
      ref={ref}
      className={`cell-input${alignRight ? ' cell-input--right' : ''}`}
      data-testid="cell-input"
      onBlur={onBlur}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <input
        type="text"
        aria-label={`${t.cellLabel} ${formatDateRu(date)}`}
        placeholder={t.cellPlaceholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <p className="cell-input__hint">{t.cellHint}</p>
      {mine.length > 0 && (
        <ul className="issues">
          {mine.map((item) => (
            <IssueItem
              key={item.id}
              part={item.part}
              issue={item.issue}
              levelNumbers={engine.levelNumbers}
              error={item.error}
              onAction={(action) => {
                if (engine.act(item, action)) removePart(item.part)
              }}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
