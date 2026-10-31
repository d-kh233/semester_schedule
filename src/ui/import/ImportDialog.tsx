import { useState } from 'react'
import { validateSubject, type EventType, type ImportanceLevel, type Subject } from '../../core/catalog'
import { DEFAULT_CROWDED_DAYS } from '../../core/crowded'
import type { IsoDate } from '../../core/dates'
import type { EventRecord } from '../../core/events'
import type { EventChange } from '../../core/parser/apply'
import { parseImportText, planImportRows } from '../../core/parser/importText'
import type { ParseContext } from '../../core/parser/parse'
import { ru } from '../../i18n/ru'
import { Modal } from '../common/Modal'
import { dateText } from '../events/format'
import { issueText } from './issueText'

interface Props {
  semesterId: string
  today: IsoDate
  semesterStart: IsoDate
  semesterEnd: IsoDate
  levels: ImportanceLevel[]
  types: EventType[]
  subjects: Subject[]
  events: EventRecord[]
  onApply: (changes: EventChange[]) => void
  onRevert: (changes: EventChange[]) => void
  onAddSubject: (name: string, shortName: string) => Subject
  onClose: () => void
}

const t = ru.importText

// Окно «Импорт текстом»: вставка, предпросмотр, запись только по кнопке «Добавить»
export function ImportDialog(props: Props) {
  const [text, setText] = useState('')
  // Что записала эта вставка: для кнопки «Отменить всю вставку»
  const [added, setAdded] = useState<EventChange[] | null>(null)
  // Текст, по которому уже записали: пока он не менялся, «Добавить» не активна
  const [addedText, setAddedText] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [subjectError, setSubjectError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const ctx: ParseContext = {
    today: props.today,
    semesterStart: props.semesterStart,
    semesterEnd: props.semesterEnd,
    levelCount: props.levels.reduce((max, l) => Math.max(max, l.number), 0),
    types: props.types,
    subjects: props.subjects,
    crowdedDays: DEFAULT_CROWDED_DAYS,
  }
  const rows = parseImportText(text, ctx)
  // Для предпросмотра id и время не важны: нужен только вид изменения
  const planned = planImportRows(rows, props.events, props.semesterId, () => '', '')
  const createCount = planned.filter((p) => p.change?.kind === 'create').length
  const updateCount = planned.filter((p) => p.change?.kind === 'update').length
  const unknownWords = [
    ...new Set(
      rows.flatMap((r) => (!r.result.ok && r.result.issue.kind === 'unknown-header' ? [r.result.issue.word] : [])),
    ),
  ]
  const canAdd = createCount + updateCount > 0 && addedText !== text

  function add() {
    const changes = planImportRows(
      rows,
      props.events,
      props.semesterId,
      () => crypto.randomUUID(),
      new Date().toISOString(),
    ).flatMap((p) => (p.change ? [p.change] : []))
    if (changes.length === 0) return
    props.onApply(changes)
    setAdded(changes)
    setAddedText(text)
    setMessage(
      t.addedSummary(
        changes.filter((c) => c.kind === 'create').length,
        changes.filter((c) => c.kind === 'update').length,
      ),
    )
  }

  function undo() {
    if (!added) return
    props.onRevert(added)
    setAdded(null)
    setAddedText(null)
    setMessage(t.undone)
  }

  // Предмет создаётся только по нажатию этой кнопки, сразу после проверки имени
  function createSubject(word: string) {
    const problem = validateSubject({ name: word, shortName: word }, props.subjects)
    if (problem) {
      setSubjectError(ru.events.subjectErrors[problem])
      return
    }
    setSubjectError(null)
    props.onAddSubject(word, word)
  }

  async function copyTemplate() {
    try {
      await navigator.clipboard.writeText(t.templateText)
      setCopied(t.templateCopied)
    } catch {
      setCopied(t.templateFailed)
    }
  }

  return (
    <Modal title={t.title} closeLabel={t.close} wide onClose={props.onClose}>
      <p className="import__hint">{t.hint}</p>
      <textarea
        className="import__text"
        aria-label={t.title}
        placeholder={t.placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <h3>{t.previewTitle}</h3>
      {rows.length === 0 ? (
        <p className="import__empty">{t.previewEmpty}</p>
      ) : (
        <ul className="import__list" data-testid="import-preview">
          {planned.map(({ row, change }, index) => {
            const status = change ? change.kind : 'error'
            const event = change ? (change.kind === 'create' ? change.event : change.after) : null
            return (
              <li key={index} className={`import__row import__row--${status}`}>
                <span className="import__line">{t.line(row.line)}</span>
                <span className={`import__status import__status--${status}`}>
                  {status === 'create' ? t.create : status === 'update' ? t.update : t.error}
                </span>
                {event ? (
                  <span className="import__text-line">{`${event.title}, ${dateText(event)}`}</span>
                ) : (
                  <span className="import__text-line">
                    {row.text}{' '}
                    <span className="import__problem">
                      {!row.result.ok && issueText(row.result.issue)}
                    </span>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {unknownWords.map((word) => (
        <button key={word} type="button" className="btn" onClick={() => createSubject(word)}>
          {t.createSubject(word)}
        </button>
      ))}
      {subjectError && <p className="import__problem">{subjectError}</p>}

      <div className="import__actions">
        <button type="button" className="btn btn--primary" disabled={!canAdd} onClick={add}>
          {t.add}
        </button>
        {added && (
          <button type="button" className="btn" onClick={undo}>
            {t.undo}
          </button>
        )}
        {message && <span className="import__summary">{message}</span>}
      </div>

      <details className="import__template">
        <summary>{t.template}</summary>
        <p className="import__hint">{t.templateHint}</p>
        <textarea readOnly value={t.templateText} aria-label={t.template} />
        <button type="button" className="btn" onClick={copyTemplate}>
          {t.copyTemplate}
        </button>
        {copied && <span className="import__summary">{copied}</span>}
      </details>
    </Modal>
  )
}
