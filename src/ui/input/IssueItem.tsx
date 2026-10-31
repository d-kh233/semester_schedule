import { useState } from 'react'
import type { ParseIssue } from '../../core/parser/parse'
import { ru } from '../../i18n/ru'

export type IssueAction =
  | { type: 'dismiss' }
  | { type: 'swap' }
  | { type: 'choose-level'; level: number }
  | { type: 'create-level'; level: number }
  | { type: 'without-subject' }
  | { type: 'create-subject'; name: string }

interface Props {
  part: string
  issue: ParseIssue
  levelNumbers: number[]
  error: string | null
  onAction: (action: IssueAction) => void
}

const t = ru.input
const MAX_CREATABLE_LEVEL = 9

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function message(issue: ParseIssue): string {
  switch (issue.kind) {
    case 'no-title':
      return t.issues.noTitle
    case 'invalid-date':
      return t.issues.invalidDate(issue.text)
    case 'invalid-time':
      return t.issues.invalidTime(issue.text)
    case 'several-dates':
      return t.issues.severalDates
    case 'end-before-start':
      return t.issues.endBeforeStart
    case 'importance-out-of-range':
      return t.issues.importance(issue.value)
    case 'unknown-subject':
      return t.issues.unknownSubject(issue.word)
  }
}

// Подсказка по одной части ввода. Часть остаётся в строке ввода, пока вопрос не решён.
export function IssueItem({ part, issue, levelNumbers, error, onAction }: Props) {
  const [creatingSubject, setCreatingSubject] = useState(false)
  const [subjectName, setSubjectName] = useState(
    issue.kind === 'unknown-subject' ? capitalize(issue.word) : '',
  )
  const dismiss = (
    <button type="button" onClick={() => onAction({ type: 'dismiss' })}>
      {issue.kind === 'end-before-start' || issue.kind === 'unknown-subject' ||
      issue.kind === 'importance-out-of-range'
        ? t.cancel
        : t.ok}
    </button>
  )

  return (
    <li className="issue" role="alert" data-testid="input-issue">
      <span className="issue__part">«{part}»</span>
      <span className="issue__text">{message(issue)}</span>
      <span className="issue__actions">
        {issue.kind === 'end-before-start' && (
          <button type="button" onClick={() => onAction({ type: 'swap' })}>
            {t.ok}
          </button>
        )}

        {issue.kind === 'importance-out-of-range' && (
          <>
            {issue.value <= MAX_CREATABLE_LEVEL && issue.value > 0 && (
              <button
                type="button"
                onClick={() => onAction({ type: 'create-level', level: issue.value })}
              >
                {t.issues.createLevel(issue.value)}
              </button>
            )}
            {levelNumbers.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => onAction({ type: 'choose-level', level })}
              >
                {t.issues.chooseLevel(level)}
              </button>
            ))}
          </>
        )}

        {issue.kind === 'unknown-subject' && !creatingSubject && (
          <>
            <button type="button" onClick={() => setCreatingSubject(true)}>
              {t.issues.createSubject}
            </button>
            <button type="button" onClick={() => onAction({ type: 'without-subject' })}>
              {t.issues.withoutSubject}
            </button>
          </>
        )}

        {issue.kind === 'unknown-subject' && creatingSubject && (
          <>
            <input
              aria-label={t.issues.subjectFullName}
              value={subjectName}
              autoFocus
              onChange={(e) => setSubjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onAction({ type: 'create-subject', name: subjectName })
              }}
            />
            <button
              type="button"
              onClick={() => onAction({ type: 'create-subject', name: subjectName })}
            >
              {t.issues.subjectCreate}
            </button>
          </>
        )}

        {dismiss}
      </span>
      {error && <span className="issue__error">{error}</span>}
    </li>
  )
}
