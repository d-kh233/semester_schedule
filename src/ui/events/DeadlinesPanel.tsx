import type { ReactNode } from 'react'
import { ru } from '../../i18n/ru'

interface Props {
  onClose: () => void
  children: ReactNode
}

// Боковая панель справа от сетки: не закрывает строку ввода и верхние кнопки
export function DeadlinesPanel({ onClose, children }: Props) {
  return (
    <aside className="deadlines" aria-label={ru.deadlines.title}>
      <div className="card__head">
        <h2>{ru.deadlines.title}</h2>
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          {ru.deadlines.close}
        </button>
      </div>
      {children}
    </aside>
  )
}
