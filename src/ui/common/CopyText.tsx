import { useState } from 'react'
import { isValidIsoDate } from '../../core/dates'
import { ru } from '../../i18n/ru'

interface Props {
  // Текст списка; until — дата «до» (включительно) или null, если дата не выбрана
  textFor: (until: string | null) => string
  ariaLabel: string
  emptyText: string
}

// Текст списка видно в поле (его можно выделить вручную), кнопка кладёт его в буфер обмена
export function CopyText({ textFor, ariaLabel, emptyText }: Props) {
  const [until, setUntil] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  const untilDate = until !== '' && isValidIsoDate(until) ? until : null
  const text = textFor(untilDate)
  const lines = text === '' ? 0 : text.split('\n').length

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setStatus(ru.copyText.copied)
    } catch {
      setStatus(ru.copyText.copyFailed)
    }
  }

  return (
    <div className="copy-text">
      {lines === 0 ? (
        <p className="copy-text__empty">{emptyText}</p>
      ) : (
        <textarea
          className="copy-text__area"
          readOnly
          rows={Math.min(Math.max(lines, 3), 12)}
          value={text}
          aria-label={ariaLabel}
        />
      )}
      <div className="copy-text__bar">
        <label className="copy-text__until">
          {ru.copyText.untilLabel}
          <input
            type="date"
            value={until}
            onChange={(e) => {
              setUntil(e.target.value)
              setStatus(null)
            }}
          />
        </label>
        <button type="button" className="btn btn--primary" disabled={lines === 0} onClick={copy}>
          {ru.copyText.copy}
        </button>
        {status && <span role="status">{status}</span>}
      </div>
    </div>
  )
}
