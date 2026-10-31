import { useEffect, type ReactNode } from 'react'

interface Props {
  title: string
  closeLabel: string
  wide?: boolean
  onClose: () => void
  children: ReactNode
}

// Окно поверх страницы: закрывается кнопкой, клавишей Escape и щелчком мимо окна
export function Modal({ title, closeLabel, wide, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Escape, уже обработанный окном поверх (карточкой), сюда не доходит
      if (e.key === 'Escape' && !e.defaultPrevented) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={wide ? 'card card--wide' : 'card'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="card__head">
          <h2>{title}</h2>
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
