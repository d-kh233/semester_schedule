import { useState, type KeyboardEvent } from 'react'
import { validateSubject, type EventType, type ImportanceLevel, type Subject } from '../../core/catalog'
import type { IsoDate } from '../../core/dates'
import type { EventRecord } from '../../core/events'
import { planChanges, type EventChange } from '../../core/parser/apply'
import {
  parseInputLine,
  splitInput,
  type ParseContext,
  type ParseIssue,
  type ParseOptions,
} from '../../core/parser/parse'
import { DEFAULT_CROWDED_DAYS } from '../../core/crowded'
import { ru } from '../../i18n/ru'
import { dateText } from '../events/format'
import { IssueItem, type IssueAction } from './IssueItem'

interface Props {
  today: IsoDate
  semesterId: string
  semesterStart: IsoDate
  semesterEnd: IsoDate
  levels: ImportanceLevel[]
  types: EventType[]
  subjects: Subject[]
  // События этого расписания (для правки текстом)
  events: EventRecord[]
  onApply: (changes: EventChange[]) => void
  onRevert: (changes: EventChange[]) => void
  onAddSubject: (name: string, shortName: string) => Subject
  // Создаёт недостающие уровни, возвращает число уровней
  onAddLevels: (upTo: number) => number
}

interface Issue {
  id: number
  part: string
  issue: ParseIssue
  options: ParseOptions
  error: string | null
}

interface Toast {
  lines: string[]
  // Что можно отменить; у сообщения «Отменено» отменять уже нечего
  changes: EventChange[] | null
}

const t = ru.input

function summary(changes: EventChange[]): string[] {
  return changes.map((change) => {
    const event = change.kind === 'create' ? change.event : change.after
    const label = change.kind === 'create' ? t.created : t.updated
    return `${label}: ${event.title}, ${dateText(event)}`
  })
}

export function QuickInput(props: Props) {
  const { levels, types, subjects, events } = props
  const [text, setText] = useState('')
  const [issues, setIssues] = useState<Issue[]>([])
  const [toast, setToast] = useState<Toast | null>(null)
  const [nextId, setNextId] = useState(1)

  function context(extra?: { levelCount?: number; subjects?: Subject[] }): ParseContext {
    return {
      today: props.today,
      semesterStart: props.semesterStart,
      semesterEnd: props.semesterEnd,
      levelCount: extra?.levelCount ?? levels.reduce((max, l) => Math.max(max, l.number), 0),
      types,
      subjects: extra?.subjects ?? subjects,
      crowdedDays: DEFAULT_CROWDED_DAYS,
    }
  }

  // Применяет разобранные события и показывает подсказку с кнопкой «Отменить»
  function apply(parsed: Parameters<typeof planChanges>[0]) {
    const changes = planChanges(
      parsed,
      events,
      props.semesterId,
      () => crypto.randomUUID(),
      new Date().toISOString(),
    )
    props.onApply(changes)
    setToast({ lines: summary(changes), changes })
  }

  function submit() {
    const parts = splitInput(text)
    if (parts.length === 0) return
    const ctx = context()
    const ready: Parameters<typeof planChanges>[0] = []
    const unresolved: Issue[] = []
    let id = nextId
    for (const part of parts) {
      const result = parseInputLine(part, ctx)
      if (result.ok) ready.push(result.event)
      else unresolved.push({ id: id++, part, issue: result.issue, options: {}, error: null })
    }
    setNextId(id)
    if (ready.length > 0) apply(ready)
    else setToast(null)
    setIssues(unresolved)
    // В строке остаются только части, с которыми ещё нужно разобраться
    setText(unresolved.map((u) => u.part).join('; '))
  }

  function removePart(part: string) {
    const parts = splitInput(text)
    const index = parts.indexOf(part)
    if (index >= 0) parts.splice(index, 1)
    setText(parts.join('; '))
  }

  function act(item: Issue, action: IssueAction) {
    if (action.type === 'dismiss') {
      setIssues((list) => list.filter((i) => i.id !== item.id))
      return
    }
    const options: ParseOptions = { ...item.options }
    let levelCount: number | undefined
    let subjectsNow: Subject[] | undefined

    if (action.type === 'swap') options.swapDates = true
    if (action.type === 'choose-level') options.importance = action.level
    if (action.type === 'without-subject') options.acceptUnknownSubject = true
    if (action.type === 'create-level') levelCount = props.onAddLevels(action.level)
    if (action.type === 'create-subject' && item.issue.kind === 'unknown-subject') {
      const problem = validateSubject({ name: action.name, shortName: item.issue.word }, subjects)
      if (problem) {
        const error = ru.events.subjectErrors[problem]
        setIssues((list) => list.map((i) => (i.id === item.id ? { ...i, error } : i)))
        return
      }
      subjectsNow = [...subjects, props.onAddSubject(action.name, item.issue.word)]
    }

    const result = parseInputLine(item.part, context({ levelCount, subjects: subjectsNow }), options)
    if (result.ok) {
      apply([result.event])
      setIssues((list) => list.filter((i) => i.id !== item.id))
      removePart(item.part)
    } else {
      setIssues((list) =>
        list.map((i) =>
          i.id === item.id ? { ...i, issue: result.issue, options, error: null } : i,
        ),
      )
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const rows = Math.min(5, Math.max(1, text.split('\n').length))
  const levelNumbers = [...levels].sort((a, b) => a.order - b.order).map((l) => l.number)

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

      {issues.length > 0 && (
        <ul className="issues">
          {issues.map((item) => (
            <IssueItem
              key={item.id}
              part={item.part}
              issue={item.issue}
              levelNumbers={levelNumbers}
              error={item.error}
              onAction={(action) => act(item, action)}
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
            <button
              type="button"
              onClick={() => {
                props.onRevert(toast.changes ?? [])
                setToast({ lines: [t.undone], changes: null })
              }}
            >
              {t.undo}
            </button>
          )}
          <button type="button" onClick={() => setToast(null)}>
            {t.close}
          </button>
        </div>
      )}
    </section>
  )
}
