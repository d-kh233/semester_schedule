// Разбиение одной части строки ввода на слова, даты и время

export type Token =
  | { kind: 'date'; raw: string; day: number; month: number; year: number | null }
  | { kind: 'rel'; raw: string; offset: number }
  | { kind: 'weekday'; raw: string; weekday: number }
  | { kind: 'time'; raw: string; hours: number; minutes: number }
  | { kind: 'dash'; raw: string }
  | { kind: 'comma'; raw: string }
  | { kind: 'word'; raw: string }

// Месяцы в родительном падеже: «13 ноября»
export const MONTH_NAMES: Record<string, number> = {
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12,
}

// 0 = понедельник
export const WEEKDAY_WORDS: Record<string, number> = {
  пн: 0,
  вт: 1,
  ср: 2,
  чт: 3,
  пт: 4,
  сб: 5,
  вс: 6,
}

export const RELATIVE_WORDS: Record<string, number> = {
  сегодня: 0,
  завтра: 1,
  послезавтра: 2,
}

const TIME = /(\d{1,2}):(\d{2})(?![\d:])/y
const DOTTED = /(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?(?!\d)/y
const DAY_MONTH = new RegExp(`(\\d{1,2})\\s+(${Object.keys(MONTH_NAMES).join('|')})(?!\\p{L})`, 'iuy')
const WORD = /[^\s,]+/y

function matchAt(pattern: RegExp, text: string, index: number): RegExpExecArray | null {
  pattern.lastIndex = index
  return pattern.exec(text)
}

export function isDateLike(token: Token | undefined): boolean {
  return token?.kind === 'date' || token?.kind === 'rel' || token?.kind === 'weekday'
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < text.length) {
    const ch = text.charAt(i)
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (ch === ',') {
      tokens.push({ kind: 'comma', raw: ',' })
      i++
      continue
    }

    const time = matchAt(TIME, text, i)
    if (time) {
      tokens.push({
        kind: 'time',
        raw: time[0],
        hours: Number(time[1]),
        minutes: Number(time[2]),
      })
      i += time[0].length
      continue
    }

    const dotted = matchAt(DOTTED, text, i)
    if (dotted) {
      tokens.push({
        kind: 'date',
        raw: dotted[0],
        day: Number(dotted[1]),
        month: Number(dotted[2]),
        year: dotted[3] === undefined ? null : Number(dotted[3]),
      })
      i += dotted[0].length
      continue
    }

    const dayMonth = matchAt(DAY_MONTH, text, i)
    if (dayMonth) {
      tokens.push({
        kind: 'date',
        raw: dayMonth[0],
        day: Number(dayMonth[1]),
        month: MONTH_NAMES[(dayMonth[2] ?? '').toLowerCase()] ?? 0,
        year: null,
      })
      i += dayMonth[0].length
      continue
    }

    // Тире между датами — период; в других местах дефис остаётся частью слова
    if (/[-–—]/.test(ch) && isDateLike(tokens[tokens.length - 1])) {
      tokens.push({ kind: 'dash', raw: ch })
      i++
      continue
    }

    const word = matchAt(WORD, text, i)
    if (!word) {
      i++
      continue
    }
    const raw = word[0]
    const lower = raw.toLowerCase()
    const relative = RELATIVE_WORDS[lower]
    const weekdayIndex = WEEKDAY_WORDS[lower]
    if (relative !== undefined) tokens.push({ kind: 'rel', raw, offset: relative })
    else if (weekdayIndex !== undefined) tokens.push({ kind: 'weekday', raw, weekday: weekdayIndex })
    else tokens.push({ kind: 'word', raw })
    i += raw.length
  }
  return tokens
}
