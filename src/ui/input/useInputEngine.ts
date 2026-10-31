import { useCallback, useState } from 'react'
import { validateSubject, type EventType, type ImportanceLevel, type Subject } from '../../core/catalog'
import { DEFAULT_CROWDED_DAYS } from '../../core/crowded'
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
import { ru } from '../../i18n/ru'
import { dateText } from '../events/format'
import type { IssueAction } from './IssueItem'

export interface EngineProps {
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

export interface Issue {
  id: number
  part: string
  issue: ParseIssue
  options: ParseOptions
  error: string | null
  // Из какой ячейки введено; null для строки ввода сверху
  fixedDate: IsoDate | null
}

export interface Toast {
  lines: string[]
  // Что можно отменить; у сообщения «Отменено» отменять уже нечего
  changes: EventChange[] | null
}

export interface InputEngine {
  issues: Issue[]
  toast: Toast | null
  // Применяет текст, возвращает часть, с которой ещё нужно разобраться
  submit: (text: string, fixedDate: IsoDate | null) => string
  // true, если подсказка решена и часть можно убрать из поля
  act: (item: Issue, action: IssueAction) => boolean
  revertToast: () => void
  closeToast: () => void
  clearIssues: (fixedDate: IsoDate | null) => void
  levelNumbers: number[]
}

const t = ru.input

function summary(changes: EventChange[]): string[] {
  return changes.map((change) => {
    const event = change.kind === 'create' ? change.event : change.after
    const label = change.kind === 'create' ? t.created : t.updated
    return `${label}: ${event.title}, ${dateText(event)}`
  })
}

// Общая логика строки ввода сверху и ввода прямо в ячейку: разбор, подсказки, «Отменить»
export function useInputEngine(props: EngineProps): InputEngine {
  const { levels, types, subjects, events } = props
  const [issues, setIssues] = useState<Issue[]>([])
  const [toast, setToast] = useState<Toast | null>(null)
  const [nextId, setNextId] = useState(1)
  // Стабильная функция: от неё зависит очистка при закрытии ячейки
  const clearIssues = useCallback(
    (fixedDate: IsoDate | null) => setIssues((list) => list.filter((i) => i.fixedDate !== fixedDate)),
    [],
  )

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

  function submit(text: string, fixedDate: IsoDate | null): string {
    const parts = splitInput(text)
    if (parts.length === 0) return ''
    const ctx = context()
    const options: ParseOptions = fixedDate ? { fixedDate } : {}
    const ready: Parameters<typeof planChanges>[0] = []
    const unresolved: Issue[] = []
    let id = nextId
    for (const part of parts) {
      const result = parseInputLine(part, ctx, options)
      if (result.ok) ready.push(result.event)
      else unresolved.push({ id: id++, part, issue: result.issue, options, error: null, fixedDate })
    }
    setNextId(id)
    if (ready.length > 0) apply(ready)
    else setToast(null)
    // Подсказки другого поля (строки сверху или другой ячейки) не трогаем
    setIssues((list) => [...list.filter((i) => i.fixedDate !== fixedDate), ...unresolved])
    return unresolved.map((u) => u.part).join('; ')
  }

  function act(item: Issue, action: IssueAction): boolean {
    if (action.type === 'dismiss') {
      setIssues((list) => list.filter((i) => i.id !== item.id))
      return false
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
        return false
      }
      subjectsNow = [...subjects, props.onAddSubject(action.name, item.issue.word)]
    }

    const result = parseInputLine(item.part, context({ levelCount, subjects: subjectsNow }), options)
    if (result.ok) {
      apply([result.event])
      setIssues((list) => list.filter((i) => i.id !== item.id))
      return true
    }
    setIssues((list) =>
      list.map((i) => (i.id === item.id ? { ...i, issue: result.issue, options, error: null } : i)),
    )
    return false
  }

  return {
    issues,
    toast,
    submit,
    act,
    revertToast: () => {
      props.onRevert(toast?.changes ?? [])
      setToast({ lines: [t.undone], changes: null })
    },
    closeToast: () => setToast(null),
    clearIssues,
    levelNumbers: [...levels].sort((a, b) => a.order - b.order).map((l) => l.number),
  }
}
