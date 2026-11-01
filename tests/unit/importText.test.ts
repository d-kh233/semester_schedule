import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog, createSubject } from '../../src/core/catalog'
import { createEvent, type EventRecord } from '../../src/core/events'
import {
  findHeaderSubject,
  parseImportText,
  planImportRows,
  type ImportRow,
} from '../../src/core/parser/importText'
import { parseInputLine, type ParseContext } from '../../src/core/parser/parse'

// Условия как в parser.test.ts: «сегодня» = 31.10.2026, семестр 2026/2027, типы по умолчанию
let n = 0
const { types } = buildDefaultCatalog(() => `id-${++n}`)
const kr = types.find((t) => t.name === 'КР')!
const quiz = types.find((t) => t.name === 'Тест')!

const subject = (name: string, shortName: string) =>
  createSubject({ name, shortName }, `sub-${shortName}`, false)
const matan = subject('Матан', 'матан')
const english = subject('Англ. яз.', 'англ')
const siibd = subject('СИИБД', 'сиибд')

const ctx: ParseContext = {
  today: '2026-10-31',
  semesterStart: '2026-09-01',
  semesterEnd: '2027-01-31',
  levelCount: 3,
  types,
  subjects: [matan, english, siibd],
  crowdedDays: 7,
}

const NOW = '2026-10-31T10:00:00.000Z'

const rowsOf = (text: string): ImportRow[] => parseImportText(text, ctx)

const eventOf = (row: ImportRow | undefined) => (row?.result.ok ? row.result.event : null)

describe('заголовок предмета', () => {
  it('находит предмет по короткому и полному имени, регистр не важен', () => {
    expect(findHeaderSubject('Матан', ctx.subjects)).toBe(matan)
    expect(findHeaderSubject('МАТАН', ctx.subjects)).toBe(matan)
    expect(findHeaderSubject('Англ. яз.', ctx.subjects)).toBe(english)
    expect(findHeaderSubject('Хим', ctx.subjects)).toBeNull()
  })
})

describe('разбор блока «предмет + строки»', () => {
  it('пример заказчицы: все строки под заголовком относятся к предмету', () => {
    const rows = rowsOf('Матан\n\nКР 1 21.10\nпрактика 2 10.11, 24.11\nтест 05.12')
    expect(rows.map((r) => r.subject?.id)).toEqual([matan.id, matan.id, matan.id])
    expect(rows.map((r) => r.line)).toEqual([3, 4, 5])

    const [exam, practice, test] = rows.map(eventOf)
    expect(exam?.title).toBe('Матан КР 1')
    expect(exam?.startDate).toBe('2026-10-21')
    expect(practice?.windows.map((w) => w.startDate)).toEqual(['2026-11-10', '2026-11-24'])
    expect(practice?.windows[0]?.planned).toBe(true)
    expect(test?.startDate).toBe('2026-12-05')
  })

  it('строка «Предмет: дедлайн КР 21.10; тест 05.12» делится по «;» и понимается', () => {
    const rows = rowsOf('Матан: дедлайн КР 21.10; тест 05.12')
    expect(rows.map((r) => r.subject?.id)).toEqual([matan.id, matan.id])
    expect(rows.map((r) => r.text)).toEqual(['КР 21.10', 'тест 05.12'])
    expect(rows.every((r) => r.result.ok)).toBe(true)
  })

  it('нумерация «1)» и «2.» срезается до разбора', () => {
    const rows = rowsOf('Матан\n1) КР 21.10\n2. тест 05.12')
    expect(rows.map((r) => r.text)).toEqual(['КР 21.10', 'тест 05.12'])
    expect(rows.every((r) => r.result.ok)).toBe(true)
  })

  it('цифра без точки не считается нумерацией, это важность (BR-12)', () => {
    const [row] = rowsOf('Матан\n1 КР 21.10')
    expect(row?.text).toBe('1 КР 21.10')
    expect(eventOf(row)?.importance).toBe(1)
  })

  it('заголовок с двоеточием «Англ. яз.:» находит предмет по полному имени', () => {
    const rows = rowsOf('Англ. яз.:\nКР 12.12')
    expect(rows[0]?.subject?.id).toBe(english.id)
    expect(eventOf(rows[0])?.startDate).toBe('2026-12-12')
  })

  it('ошибка в одной строке не мешает остальным', () => {
    const rows = rowsOf('Матан\nКР 32.10\nтест 05.12')
    expect(rows[0]?.result).toEqual({
      ok: false,
      issue: { kind: 'parse', issue: { kind: 'invalid-date', text: '32.10' } },
    })
    expect(rows[1]?.result.ok).toBe(true)
  })

  it('строки до первого заголовка получают ошибку «нет предмета», остальные разбираются', () => {
    const rows = rowsOf('КР 21.10\nМатан\nтест 05.12')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.result).toEqual({ ok: false, issue: { kind: 'no-header' } })
    expect(eventOf(rows[1])?.startDate).toBe('2026-12-05')
  })

  it('неизвестный заголовок: строки получают ошибку, слово показано как написано', () => {
    const rows = rowsOf('Хим\nтест 13.11')
    expect(rows[0]?.result).toEqual({
      ok: false,
      issue: { kind: 'unknown-header', word: 'Хим' },
    })
  })

  it('даты без года выбираются по семестру', () => {
    const rows = rowsOf('Матан\nтест 15.01\nКР 21.10')
    expect(rows.map((r) => eventOf(r)?.startDate)).toEqual(['2027-01-15', '2026-10-21'])
  })

  it('пустые строки и строки без содержания пропускаются', () => {
    expect(rowsOf('\n  \nМатан\n;\n')).toEqual([])
  })
})

describe('план вставки: создать или обновить (BR-14)', () => {
  let m = 0
  const newId = () => `new-${++m}`
  const existing: EventRecord[] = [
    createEvent(
      {
        title: 'Матан КР',
        typeId: kr.id,
        subjectId: matan.id,
        startDate: '2026-10-21',
        endDate: '2026-10-21',
        time: null,
        importance: null,
        note: '',
        done: false,
      },
      { id: 'ev-1', semesterId: 'sem-1' },
      NOW,
    ),
  ]

  it('совпали предмет, дата и название: строка обновит событие, важность меняется', () => {
    const planned = planImportRows(rowsOf('Матан\n2 КР 21.10'), existing, 'sem-1', newId, NOW)
    const change = planned[0]?.change
    expect(change?.kind).toBe('update')
    if (change?.kind === 'update') {
      expect(change.before.id).toBe('ev-1')
      expect(change.after.importance).toBe(2)
    }
  })

  it('другая дата — новое событие', () => {
    const planned = planImportRows(rowsOf('Матан\n2 КР 22.10'), existing, 'sem-1', newId, NOW)
    expect(planned[0]?.change?.kind).toBe('create')
  })

  it('две одинаковые строки в одной вставке: первая создаёт, вторая обновляет её', () => {
    const planned = planImportRows(rowsOf('Матан\nтест 05.12\nтест 05.12'), [], 'sem-1', newId, NOW)
    expect(planned.map((p) => p.change?.kind)).toEqual(['create', 'update'])
  })

  it('строка с ошибкой не даёт изменения, остальные планируются', () => {
    const planned = planImportRows(rowsOf('Матан\nКР 32.10\nтест 05.12'), [], 'sem-1', newId, NOW)
    expect(planned.map((p) => p.change?.kind)).toEqual([undefined, 'create'])
    expect(planned[0]?.change).toBeNull()
  })

  it('событие создаётся с предметом и типом из блока', () => {
    const planned = planImportRows(rowsOf('Матан\nтест 05.12'), [], 'sem-1', newId, NOW)
    const change = planned[0]?.change
    if (change?.kind !== 'create') throw new Error('ожидали создание')
    expect(change.event.subjectId).toBe(matan.id)
    expect(change.event.typeId).toBe(quiz.id)
    expect(change.event.semesterId).toBe('sem-1')
  })
})

describe('подсказка предмета для разбора строки (ParseOptions.subject)', () => {
  it('заданный предмет берётся без слова в строке', () => {
    const result = parseInputLine('КР 21.10', ctx, { subject: matan })
    expect(result.ok && result.event.subjectId).toBe(matan.id)
    expect(result.ok && result.event.title).toBe('Матан КР')
  })
})

// Список как на экране: «Предмет · Тип · дата». Строки-названия над ними пропускаются.
describe('импорт строк списка с «·»', () => {
  const list = [
    'Матан КР 1',
    'Матан · КР · 21.10.2026',
    'СИИБД РТ 3,4',
    'СИИБД · Практика · 10.11.2026',
    'Матан практика 2',
    'Матан · Практика · 10.11.2026 · окна: 10.11.2026 (планируемое), 24.11.2026 (людное)',
    'Англ. яз. тест',
    'Англ. яз. · Тест · 13.11.2026 17:00',
    'Хакатон',
    'Хакатон · 13.10.2026 – 15.11.2026',
    'Матан Тест',
    'Матан · Тест · 05.12.2026',
    'Англ. яз. КР',
    'Англ. яз. · КР · 12.12.2026',
    'Матан КР',
    'Матан · КР · 14.12.2026 · выполнено',
    'Подготовка к экзаменам',
    'Подготовка к экзаменам · 15.12.2026 – 31.12.2026',
    'Физра тест',
    'Физра · Тест · без даты',
  ].join('\n')

  const rows = parseImportText(list, ctx)

  it('каждая строка «·» даёт строку, строки-названия пропускаются', () => {
    expect(rows).toHaveLength(10)
  })

  it('обычная строка: предмет, тип и дата', () => {
    const row = rows[0]!
    expect(row.result.ok).toBe(true)
    if (row.result.ok) {
      expect(row.result.event.subjectId).toBe(matan.id)
      expect(row.result.event.endDate).toBe('2026-10-21')
    }
  })

  it('окна практики и время', () => {
    const practice = rows[2]!
    const timed = rows[3]!
    expect(practice.result.ok && practice.result.event.windows).toHaveLength(2)
    expect(timed.result.ok && timed.result.event.time).toBe('17:00')
  })

  it('период через тире и строка без предмета (хакатон)', () => {
    const hack = rows[4]!
    expect(hack.result.ok).toBe(true)
    if (hack.result.ok) {
      expect(hack.result.event.startDate).toBe('2026-10-13')
      expect(hack.result.event.endDate).toBe('2026-11-15')
    }
  })

  it('«выполнено» отмечает событие сделанным', () => {
    const done = rows[7]!
    expect(done.result.ok && done.result.event.done).toBe(true)
  })

  it('неизвестный предмет даёт ошибку с предметом, остальные строки целы', () => {
    const physical = rows[9]!
    expect(physical.result.ok).toBe(false)
    if (!physical.result.ok) expect(physical.result.issue).toEqual({ kind: 'unknown-header', word: 'Физра' })
    expect(rows[8]!.result.ok).toBe(true)
  })
})
