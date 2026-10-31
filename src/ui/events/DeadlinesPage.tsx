import type { ReactNode } from 'react'
import { ru } from '../../i18n/ru'

interface Props {
  children: ReactNode
}

// Отдельная страница на вкладке «Список дедлайнов»
export function DeadlinesPage({ children }: Props) {
  return (
    <section className="deadlines" aria-label={ru.deadlines.title}>
      <h2>{ru.deadlines.title}</h2>
      {children}
    </section>
  )
}
