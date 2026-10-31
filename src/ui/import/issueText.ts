import type { ImportIssue } from '../../core/parser/importText'
import { ru } from '../../i18n/ru'

// Текст ошибки строки импорта. Тексты только из ru.ts
export function issueText(issue: ImportIssue): string {
  if (issue.kind === 'no-header') return ru.importText.noHeader
  if (issue.kind === 'unknown-header') return ru.importText.unknownHeader(issue.word)
  const parsed = issue.issue
  switch (parsed.kind) {
    case 'no-title':
      return ru.input.issues.noTitle
    case 'invalid-date':
      return ru.input.issues.invalidDate(parsed.text)
    case 'invalid-time':
      return ru.input.issues.invalidTime(parsed.text)
    case 'several-dates':
      return ru.input.issues.severalDates
    case 'importance-out-of-range':
      return ru.importText.importanceRange(parsed.value)
    case 'end-before-start':
      return ru.events.errors['end-before-start']
    case 'unknown-subject':
      return ru.input.issues.unknownSubject(parsed.word)
  }
}
