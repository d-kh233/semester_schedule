// Разбор строки ввода (раздел 8 ТЗ). Чистые функции: «сегодня» приходит параметром.

import { isPracticeType, type EventType, type Subject } from '../catalog'
import { isCrowdedDate } from '../crowded'
import { addDays, compareIsoDates, formatIsoDate, isValidIsoDate, type IsoDate } from '../dates'
import { inferDate, resolveWeekday } from './dates'
import { isDateLike, tokenize, type Token } from './tokenize'

export interface ParseContext {
  today: IsoDate
  semesterStart: IsoDate
  semesterEnd: IsoDate
  // Число заданных уровней важности
  levelCount: number
  types: EventType[]
  subjects: Subject[]
  crowdedDays: number
}

// Решения пользователя на подсказки: строка разбирается заново с ними
export interface ParseOptions {
  swapDates?: boolean
  acceptUnknownSubject?: boolean
  // Выбранный уровень вместо несуществующего
  importance?: number
}

export interface ParsedWindow {
  startDate: IsoDate
  endDate: IsoDate
  planned: boolean
  crowded: boolean
}

export interface ParsedEvent {
  title: string
  typeId: string | null
  subjectId: string | null
  startDate: IsoDate | null
  endDate: IsoDate | null
  time: string | null
  // Только заданная в строке; иначе важность берётся у типа
  importance: number | null
  // Окна практики, если их несколько; иначе пусто
  windows: ParsedWindow[]
}

export type ParseIssue =
  | { kind: 'no-title' }
  | { kind: 'invalid-date'; text: string }
  | { kind: 'invalid-time'; text: string }
  | { kind: 'several-dates' }
  | { kind: 'importance-out-of-range'; value: number }
  | { kind: 'end-before-start' }
  | { kind: 'unknown-subject'; word: string }

export type ParseResult = { ok: true; event: ParsedEvent } | { ok: false; issue: ParseIssue }

// Несколько событий делятся по «;» и переносу строки, пустые части отбрасываются (BR-13)
export function splitInput(text: string): string[] {
  return text
    .split(/[;\r\n]+/)
    .map((part) => part.trim())
    .filter((part) => part !== '')
}

const INTEGER = /^\d+$/

interface DateItem {
  start: Token
  end: Token | null
}

function resolveDate(token: Token, ctx: ParseContext): IsoDate | null {
  if (token.kind === 'rel') return addDays(ctx.today, token.offset)
  if (token.kind === 'weekday') return resolveWeekday(token.weekday, ctx.today)
  if (token.kind !== 'date') return null
  if (token.year !== null) {
    const date = formatIsoDate(token.year, token.month, token.day)
    return isValidIsoDate(date) ? date : null
  }
  return inferDate(token.day, token.month, ctx.semesterStart, ctx.semesterEnd)
}

function two(n: number): string {
  return String(n).padStart(2, '0')
}

export function parseInputLine(
  raw: string,
  ctx: ParseContext,
  options: ParseOptions = {},
): ParseResult {
  const tokens = tokenize(raw)
  // Какие слова уже заняты датой, временем, важностью
  const used = new Set<number>()

  // 1. Даты: «21.10», период «13.10–15.11», список через запятую «10.11, 24.11»
  const items: DateItem[] = []
  let groupLast = -1
  let separateGroups = false
  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i) || !isDateLike(tokens[i])) continue
    if (items.length > 0) {
      separateGroups = true
      used.add(i)
      continue
    }
    let j = i
    for (;;) {
      const start = tokens[j]
      if (!start) break
      used.add(j)
      let end: Token | null = null
      const maybeEnd = tokens[j + 2]
      if (tokens[j + 1]?.kind === 'dash' && maybeEnd && isDateLike(maybeEnd)) {
        used.add(j + 1)
        used.add(j + 2)
        end = maybeEnd
        j += 3
      } else {
        j += 1
      }
      items.push({ start, end })
      const next = tokens[j + 1]
      if (tokens[j]?.kind === 'comma' && next && isDateLike(next)) {
        used.add(j)
        j += 1
        continue
      }
      break
    }
    groupLast = j - 1
    i = j - 1
  }

  // 2. Время
  let time: string | null = null
  let badTime: string | null = null
  tokens.forEach((token, i) => {
    if (token.kind !== 'time') return
    used.add(i)
    if (time !== null || badTime !== null) return
    if (token.hours > 23 || token.minutes > 59) badTime = token.raw
    else time = `${two(token.hours)}:${two(token.minutes)}`
  })

  // 3. Важность: первое слово или последнее слово после даты (BR-12)
  let explicitImportance: number | null = null
  const firstToken = tokens[0]
  let lastIndex = tokens.length - 1
  while (lastIndex >= 0 && tokens[lastIndex]?.kind === 'time') lastIndex--
  const lastToken = tokens[lastIndex]
  if (firstToken?.kind === 'word' && INTEGER.test(firstToken.raw) && !used.has(0)) {
    explicitImportance = Number(firstToken.raw)
    used.add(0)
  } else if (
    lastToken?.kind === 'word' &&
    INTEGER.test(lastToken.raw) &&
    items.length > 0 &&
    lastIndex > groupLast &&
    !used.has(lastIndex)
  ) {
    explicitImportance = Number(lastToken.raw)
    used.add(lastIndex)
  }
  const importance = options.importance ?? explicitImportance

  // 4. Тип по ключевому слову
  const isFree = (i: number) => tokens[i]?.kind === 'word' && !used.has(i)
  let typeIndex = -1
  let type: EventType | null = null
  for (let i = 0; i < tokens.length && type === null; i++) {
    if (!isFree(i)) continue
    const word = (tokens[i]?.raw ?? '').toLowerCase()
    const found = ctx.types.find((t) => t.keywords.includes(word))
    if (found) {
      type = found
      typeIndex = i
    }
  }
  // «практика 2»: цифра сразу после типа — часть названия
  const phraseIndex =
    type !== null && isFree(typeIndex + 1) && INTEGER.test(tokens[typeIndex + 1]?.raw ?? '')
      ? typeIndex + 1
      : -1

  // 5. Предмет по короткому имени
  let subjectIndex = -1
  let subject: Subject | null = null
  for (let i = 0; i < tokens.length && subject === null; i++) {
    if (!isFree(i) || i === typeIndex || i === phraseIndex) continue
    const word = (tokens[i]?.raw ?? '').toLowerCase()
    const found = ctx.subjects.find((s) => s.shortName.toLowerCase() === word)
    if (found) {
      subject = found
      subjectIndex = i
    }
  }

  // Слово прямо перед типом, которое не предмет: возможно, неизвестный предмет
  let unknownSubject: string | null = null
  if (subject === null && type !== null && typeIndex > 0) {
    const previous = tokens[typeIndex - 1]
    if (isFree(typeIndex - 1) && previous && !INTEGER.test(previous.raw)) {
      unknownSubject = previous.raw.toLowerCase()
    }
  }

  // 6. Название: оставшиеся слова; если пусто, «Предмет Тип»
  const words: string[] = []
  tokens.forEach((token, i) => {
    if (token.kind !== 'word' || used.has(i) || i === subjectIndex) return
    if (i === typeIndex && phraseIndex < 0) return
    words.push(token.raw)
  })
  let title: string
  if (phraseIndex >= 0) title = [subject?.name, ...words].filter(Boolean).join(' ')
  else if (words.length > 0) title = words.join(' ')
  else title = [subject?.name, type?.name].filter(Boolean).join(' ')

  // 7. Даты в календарных числах
  const ranges: { start: IsoDate; end: IsoDate; reversed: boolean }[] = []
  let invalidDate: string | null = null
  for (const item of items) {
    const start = resolveDate(item.start, ctx)
    const end = item.end ? resolveDate(item.end, ctx) : start
    if (start === null || end === null) {
      invalidDate ??= start === null ? item.start.raw : (item.end?.raw ?? item.start.raw)
      continue
    }
    const reversed = compareIsoDates(end, start) < 0
    const swap = reversed && options.swapDates === true
    ranges.push({
      start: swap ? end : start,
      end: swap ? start : end,
      reversed: reversed && !swap,
    })
  }

  // Ошибки по порядку: сначала неисправимые, потом вопросы к пользователю
  if (invalidDate !== null) return { ok: false, issue: { kind: 'invalid-date', text: invalidDate } }
  if (badTime !== null) return { ok: false, issue: { kind: 'invalid-time', text: badTime } }
  if (separateGroups || (ranges.length > 1 && !isPracticeType(type))) {
    return { ok: false, issue: { kind: 'several-dates' } }
  }
  if (title === '') return { ok: false, issue: { kind: 'no-title' } }
  if (importance !== null && (importance < 1 || importance > ctx.levelCount)) {
    return { ok: false, issue: { kind: 'importance-out-of-range', value: importance } }
  }
  if (ranges.some((r) => r.reversed)) return { ok: false, issue: { kind: 'end-before-start' } }
  if (unknownSubject !== null && options.acceptUnknownSubject !== true) {
    return { ok: false, issue: { kind: 'unknown-subject', word: unknownSubject } }
  }

  // 8. Окна практики: планируемое — самое раннее
  const sorted = [...ranges].sort((a, b) => compareIsoDates(a.start, b.start))
  const windows: ParsedWindow[] =
    sorted.length > 1
      ? sorted.map((r, i) => ({
          startDate: r.start,
          endDate: r.end,
          planned: i === 0,
          crowded: isCrowdedDate(r.end, ctx.crowdedDays),
        }))
      : []
  const main = sorted[0] ?? null

  return {
    ok: true,
    event: {
      title,
      typeId: type?.id ?? null,
      subjectId: subject?.id ?? null,
      startDate: main?.start ?? null,
      endDate: main?.end ?? null,
      time,
      importance,
      windows,
    },
  }
}

export function parseInput(
  text: string,
  ctx: ParseContext,
  options?: ParseOptions,
): { part: string; result: ParseResult }[] {
  return splitInput(text).map((part) => ({ part, result: parseInputLine(part, ctx, options) }))
}
