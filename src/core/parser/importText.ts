// Импорт текстом по предмету: строки-заголовки предметов и строки дедлайнов под ними.
// Каждая строка дедлайна разбирается тем же разбором, что строка ввода (parseInputLine).
// Чистые функции: «сегодня» и предметы приходят параметрами.

import type { Subject } from '../catalog'
import type { EventRecord } from '../events'
import { planChanges, type EventChange } from './apply'
import { parseInputLine, type ParseContext, type ParseIssue, type ParsedEvent } from './parse'
import { isDateLike, tokenize } from './tokenize'

export type ImportIssue =
  | { kind: 'no-header' }
  | { kind: 'unknown-header'; word: string }
  | { kind: 'parse'; issue: ParseIssue }

export type ImportResult = { ok: true; event: ParsedEvent } | { ok: false; issue: ImportIssue }

export interface ImportRow {
  // Номер строки в тексте, с 1
  line: number
  // Текст после срезания нумерации и слова «дедлайн»
  text: string
  // Что написано в заголовке блока; null, если заголовка выше не было
  header: string | null
  // Предмет из заголовка; null, если заголовка нет или предмета нет в списке
  subject: Subject | null
  result: ImportResult
}

// Нумерация «1)» и «2.» с пробелом после. «1 КР» без точки — это важность (BR-12)
const NUMBERING = /^\s*\d+[.)]\s+/
// Слово «дедлайн» в начале строки: «Матан: дедлайн КР 21.10»
const DEADLINE_WORD = /^дедлайны?(?:\s*:\s*|\s+|$)/i
// «Заголовок: остальное». Двоеточие перед цифрой — это время, не разделитель
const COLON_HEADER = /^([^:]*?)\s*:(?!\d)(.*)$/

// Предмет по короткому имени, а если его нет, по полному (регистр не важен)
export function findHeaderSubject(header: string, subjects: Subject[]): Subject | null {
  const key = header.trim().toLowerCase()
  return (
    subjects.find((s) => s.shortName.toLowerCase() === key) ??
    subjects.find((s) => s.name.toLowerCase() === key) ??
    null
  )
}

// Заголовок — слова без дат, времени и ключевых слов типов
function isHeaderText(text: string, ctx: ParseContext): boolean {
  if (text === '') return false
  const tokens = tokenize(text)
  if (tokens.some((t) => isDateLike(t) || t.kind === 'time')) return false
  return !tokens.some(
    (t) => t.kind === 'word' && ctx.types.some((type) => type.keywords.includes(t.raw.toLowerCase())),
  )
}

interface HeaderLine {
  header: string
  // Текст после двоеточия; null, если заголовок стоит на отдельной строке
  rest: string | null
}

// «Матан», «Англ. яз.:», «Матан: дедлайн КР 21.10; тест 05.12»
function splitHeader(trimmed: string, ctx: ParseContext): HeaderLine | null {
  const colon = COLON_HEADER.exec(trimmed)
  if (colon) {
    const header = (colon[1] ?? '').trim()
    return isHeaderText(header, ctx) ? { header, rest: colon[2] ?? '' } : null
  }
  // Без двоеточия заголовок — одно слово на отдельной строке
  if (/[\s;]/.test(trimmed)) return null
  return isHeaderText(trimmed, ctx) ? { header: trimmed, rest: null } : null
}

function cleanRowText(piece: string): string {
  return piece.trim().replace(NUMBERING, '').replace(DEADLINE_WORD, '').trim()
}

function parseRow(
  text: string,
  line: number,
  header: string | null,
  subject: Subject | null,
  ctx: ParseContext,
): ImportRow {
  const base = { line, text, header, subject }
  if (header === null) return { ...base, result: { ok: false, issue: { kind: 'no-header' } } }
  if (subject === null) {
    return { ...base, result: { ok: false, issue: { kind: 'unknown-header', word: header } } }
  }
  const result = parseInputLine(text, ctx, { subject })
  if (result.ok) return { ...base, result: { ok: true, event: result.event } }
  return { ...base, result: { ok: false, issue: { kind: 'parse', issue: result.issue } } }
}

// Разбор всего текста: каждая непустая строка дедлайна становится ImportRow.
// Ошибка в одной строке не мешает остальным.
export function parseImportText(text: string, ctx: ParseContext): ImportRow[] {
  const rows: ImportRow[] = []
  let header: string | null = null
  let subject: Subject | null = null
  const lines = text.split(/\r?\n/)

  lines.forEach((raw, index) => {
    const trimmed = raw.trim()
    if (trimmed === '') return
    // Строка списка «Матан · КР · 21.10.2026»
    if (trimmed.includes(DOT)) {
      rows.push(parseDotRow(trimmed, index + 1, ctx))
      return
    }
    // Строка-название над строкой со «·» повторяет её, пропускаем
    if (nextLineHasDot(lines, index)) return
    const found = splitHeader(trimmed, ctx)
    let pieces: string[]
    if (found) {
      header = found.header
      subject = findHeaderSubject(found.header, ctx.subjects)
      pieces = found.rest === null ? [] : found.rest.split(';')
    } else {
      pieces = trimmed.split(';')
    }
    for (const piece of pieces) {
      const body = cleanRowText(piece)
      if (body === '') continue
      rows.push(parseRow(body, index + 1, header, subject, ctx))
    }
  })
  return rows
}

const DOT = '·'
const DONE_WORD = /выполнено/i
const WINDOWS_PREFIX = /^окна\s*:/i
const DATE_IN_TEXT = /\d{1,2}\.\d{1,2}(?:\.\d{2,4})?/g
const DASH_BETWEEN_DATES = /\s*[–—-]\s*(?=\d)/g

function nextLineHasDot(lines: string[], index: number): boolean {
  const next = lines.slice(index + 1).find((line) => line.trim() !== '')
  return next !== undefined && next.includes(DOT)
}

// Даты и время строки списка в виде, который понимает строка ввода
function datesOf(parts: string[]): string {
  const windows = parts.find((p) => WINDOWS_PREFIX.test(p))
  if (windows) return (windows.match(DATE_IN_TEXT) ?? []).join(', ')
  return parts
    .filter((p) => p !== '' && !/^без даты$/i.test(p) && !DONE_WORD.test(p))
    .map((p) => p.replace(DASH_BETWEEN_DATES, '–'))
    .join(' ')
}

function isTypeWord(word: string, ctx: ParseContext): boolean {
  const key = word.trim().toLowerCase()
  return ctx.types.some((t) => t.name.toLowerCase() === key || t.keywords.includes(key))
}

// «Матан · КР · 21.10.2026 · окна: …» или «Хакатон · 13.10.2026 – 15.11.2026» (без предмета)
function parseDotRow(text: string, line: number, ctx: ParseContext): ImportRow {
  const parts = text.split(DOT).map((p) => p.trim())
  const [first = '', ...rest] = parts
  const done = rest.some((p) => DONE_WORD.test(p))

  if (isTypeWord(first, ctx)) {
    const body = [first, datesOf(rest)].filter((x) => x !== '').join(' ')
    const result = parseInputLine(body, ctx)
    const base = { line, text: body, header: null, subject: null }
    if (!result.ok) return { ...base, result: { ok: false, issue: { kind: 'parse', issue: result.issue } } }
    return { ...base, result: { ok: true, event: { ...result.event, done } } }
  }

  const [typePart = '', ...dateParts] = rest
  const body = [typePart, datesOf(dateParts)].filter((x) => x !== '').join(' ')
  const subject = findHeaderSubject(first, ctx.subjects)
  const row = parseRow(body, line, first, subject, ctx)
  if (!row.result.ok || !done) return row
  return { ...row, result: { ok: true, event: { ...row.result.event, done } } }
}

export interface PlannedRow {
  row: ImportRow
  // Что сделать с этой строкой; null, если строка с ошибкой
  change: EventChange | null
}

// Создать или обновить для каждой строки (BR-14). Список событий не меняется.
export function planImportRows(
  rows: ImportRow[],
  existing: EventRecord[],
  semesterId: string,
  newId: () => string,
  now: string,
): PlannedRow[] {
  const ready = rows.flatMap((row) => (row.result.ok ? [row.result.event] : []))
  const changes = planChanges(ready, existing, semesterId, newId, now)
  let next = 0
  return rows.map((row) => ({
    row,
    change: row.result.ok ? (changes[next++] ?? null) : null,
  }))
}
