import { useState, type KeyboardEvent } from 'react'
import { splitInput } from '../../core/parser/parse'
import { ru } from '../../i18n/ru'
import { IssueItem } from './IssueItem'
import type { InputEngine } from './useInputEngine'

interface Props {
  engine: InputEngine
}

const t = ru.input

// Строка ввода над сеткой: дата берётся из текста
export function QuickInput({ engine }: Props) {
  const [text, setText] = useState('')

  function removePart(part: string) {
    const parts = splitInput(text)
    const index = parts.indexOf(part)
    if (index >= 0) parts.splice(index, 1)
    setText(parts.join('; '))
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (splitInput(text).length === 0) return
      // В строке остаются только части, с которыми ещё нужно разобраться
      setText(engine.submit(text, null))
    }
  }

  const rows = Math.min(5, Math.max(1, text.split('\n').length))
  const { toast } = engine

  return (
    <section className="quick-input">
      <textarea
        aria-label={t.label}
        placeholder={t.placeholder}
        rows={rows}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <p className="quick-input__hint">{t.hint}</p>

      {engine.issues.some((i) => i.fixedDate === null) && (
        <ul className="issues">
          {engine.issues
            .filter((i) => i.fixedDate === null)
            .map((item) => (
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

      {toast && (
        <div className="toast" role="status" data-testid="input-toast">
          <span className="toast__lines">
            {toast.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
          {toast.changes && (
            <button type="button" onClick={engine.revertToast}>
              {t.undo}
            </button>
          )}
          <button type="button" onClick={engine.closeToast}>
            {t.close}
          </button>
        </div>
      )}
    </section>
  )
}
