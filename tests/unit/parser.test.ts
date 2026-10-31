import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog, createSubject } from '../../src/core/catalog'
import {
  parseInput,
  parseInputLine,
  splitInput,
  type ParseContext,
  type ParseIssue,
  type ParseOptions,
  type ParsedEvent,
} from '../../src/core/parser/parse'

// Условия из раздела 13 ТЗ: «сегодня» = 31.10.2026 (суббота), семестр 2026 года,
// три уровня важности, предметы «Матан», «Англ. яз.», «СИИБД», «Физра», типы по умолчанию
let n = 0
const { types } = buildDefaultCatalog(() => `id-${++n}`)
const byName = (name: string) => types.find((t) => t.name === name)!
const kr = byName('КР')
const practice = byName('Практика')
const quiz = byName('Тест')
const hackathon = byName('Хакатон')

const subject = (name: string, shortName: string) =>
  createSubject({ name, shortName }, `sub-${shortName}`, false)
const matan = subject('Матан', 'матан')
const english = subject('Англ. яз.', 'англ')
const siibd = subject('СИИБД', 'сиибд')
const fizra = subject('Физра', 'физра')

const ctx: ParseContext = {
  today: '2026-10-31',
  semesterStart: '2026-09-01',
  semesterEnd: '2027-01-31',
  levelCount: 3,
  types,
  subjects: [matan, english, siibd, fizra],
  crowdedDays: 7,
}

function ok(text: string, context: ParseContext = ctx, options?: ParseOptions): ParsedEvent {
  const result = parseInputLine(text, context, options)
  if (!result.ok) throw new Error(`Ожидали событие, получили ошибку: ${JSON.stringify(result.issue)}`)
  return result.event
}

function issueOf(text: string, context: ParseContext = ctx, options?: ParseOptions): ParseIssue {
  const result = parseInputLine(text, context, options)
  if (result.ok) throw new Error(`Ожидали ошибку, получили событие: ${JSON.stringify(result.event)}`)
  return result.issue
}

// Важность с учётом типа: ручная, иначе важность типа
const effective = (e: ParsedEvent) =>
  e.importance ?? types.find((t) => t.id === e.typeId)?.defaultImportance ?? null

describe('splitInput (BR-13)', () => {
  it('делит по «;» и по переносам строки', () => {
    expect(splitInput('а; б\nв\r\nг')).toEqual(['а', 'б', 'в', 'г'])
  })

  it('пустые части отбрасываются, пробелы по краям убираются', () => {
    expect(splitInput('  а ;; \n ; б  ')).toEqual(['а', 'б'])
    expect(splitInput('')).toEqual([])
    expect(splitInput(' ; \n ')).toEqual([])
  })

  it('одна строка без разделителя — одно событие', () => {
    expect(splitInput('1 матан кр 21.10')).toEqual(['1 матан кр 21.10'])
  })
})

describe('TC: разбор строки ввода', () => {
  it('TC-1: «1 матан кр 21.10»', () => {
    const e = ok('1 матан кр 21.10')
    expect(e.title).toBe('Матан КР')
    expect(e.typeId).toBe(kr.id)
    expect(e.subjectId).toBe(matan.id)
    expect(e.importance).toBe(1)
    expect(e.startDate).toBe('2026-10-21')
    expect(e.endDate).toBe('2026-10-21')
    expect(e.time).toBeNull()
  })

  it('TC-2: цифра после даты — важность, результат как в TC-1', () => {
    expect(ok('матан кр 21.10 1')).toEqual(ok('1 матан кр 21.10'))
  })

  it('TC-3: без цифры важность 1 по типу КР', () => {
    const e = ok('матан кр 21.10')
    expect(e.importance).toBeNull()
    expect(effective(e)).toBe(1)
    expect(e.title).toBe('Матан КР')
  })

  it('TC-4: цифра перебивает тип', () => {
    const e = ok('3 СИИБД кр 21.10')
    expect(e.typeId).toBe(kr.id)
    expect(e.subjectId).toBe(siibd.id)
    expect(e.importance).toBe(3)
    expect(e.title).toBe('СИИБД КР')
  })

  it('TC-5: хакатон с периодом', () => {
    const e = ok('хакатон 13.10–15.11')
    expect(e.typeId).toBe(hackathon.id)
    expect(e.startDate).toBe('2026-10-13')
    expect(e.endDate).toBe('2026-11-15')
    expect(e.title).toBe('Хакатон')
    expect(effective(e)).toBeNull()
  })

  it('TC-6: дефис с пробелами и тире равнозначны', () => {
    expect(ok('хакатон 13.10 - 15.11')).toEqual(ok('хакатон 13.10–15.11'))
    expect(ok('хакатон 13.10-15.11')).toEqual(ok('хакатон 13.10–15.11'))
    expect(ok('хакатон 13.10 — 15.11')).toEqual(ok('хакатон 13.10–15.11'))
  })

  it('TC-7: предмет, тип, время', () => {
    const e = ok('англ тест 13.11 17:00')
    expect(e.subjectId).toBe(english.id)
    expect(e.typeId).toBe(quiz.id)
    expect(effective(e)).toBe(3)
    expect(e.time).toBe('17:00')
    expect(e.startDate).toBe('2026-11-13')
    expect(e.title).toBe('Англ. яз. Тест')
  })

  it('TC-8: практика с двумя окнами, планируемое самое раннее, людное 24.11', () => {
    const e = ok('практика СИИБД 10.11, 24.11')
    expect(e.typeId).toBe(practice.id)
    expect(effective(e)).toBe(2)
    expect(e.startDate).toBe('2026-11-10')
    expect(e.endDate).toBe('2026-11-10')
    expect(e.windows).toEqual([
      { startDate: '2026-11-10', endDate: '2026-11-10', planned: true, crowded: false },
      { startDate: '2026-11-24', endDate: '2026-11-24', planned: false, crowded: true },
    ])
  })

  it('TC-8: планируемое окно — самое раннее, даже если в строке оно не первое', () => {
    const e = ok('практика СИИБД 24.11, 10.11')
    expect(e.startDate).toBe('2026-11-10')
    expect(e.windows.map((w) => [w.startDate, w.planned])).toEqual([
      ['2026-11-10', true],
      ['2026-11-24', false],
    ])
  })

  it('TC-9: цифра в середине — часть названия', () => {
    const e = ok('практика 2 матан 21.10')
    expect(e.title).toBe('Матан практика 2')
    expect(e.importance).toBeNull()
    expect(effective(e)).toBe(2)
    expect(e.typeId).toBe(practice.id)
    expect(e.subjectId).toBe(matan.id)
    expect(e.startDate).toBe('2026-10-21')
  })

  it('TC-10: без даты — «Когда-нибудь»', () => {
    const e = ok('тест физра')
    expect(e.startDate).toBeNull()
    expect(e.endDate).toBeNull()
    expect(e.title).toBe('Физра Тест')
    expect(e.subjectId).toBe(fizra.id)
  })

  it('TC-11: «завтра»', () => {
    expect(ok('англ тест завтра').startDate).toBe('2026-11-01')
  })

  it('TC-12: день недели — ближайшая дата строго после сегодняшней', () => {
    expect(ok('матан кр пт').startDate).toBe('2026-11-06')
  })

  it('TC-13: «13 ноября»', () => {
    expect(ok('англ тест 13 ноября').startDate).toBe('2026-11-13')
  })

  it('TC-14: регистр не важен', () => {
    expect(ok('Матан КР 21.10')).toEqual(ok('матан кр 21.10'))
    expect(ok('МАТАН кр 21.10')).toEqual(ok('матан кр 21.10'))
  })

  it('TC-15: уровня 5 нет — не создаётся, предлагается создать уровень или выбрать 1–3', () => {
    expect(issueOf('5 матан кр 21.10')).toEqual({ kind: 'importance-out-of-range', value: 5 })
    // выбор из существующих
    expect(ok('5 матан кр 21.10', ctx, { importance: 3 }).importance).toBe(3)
    // создание уровня: после него число уровней больше
    expect(ok('5 матан кр 21.10', { ...ctx, levelCount: 5 }).importance).toBe(5)
  })

  it('TC-16: нет названия — не создаётся, просит название', () => {
    expect(issueOf('21.10')).toEqual({ kind: 'no-title' })
  })

  it('TC-17: несуществующая дата', () => {
    expect(issueOf('матан кр 32.10')).toEqual({ kind: 'invalid-date', text: '32.10' })
  })

  it('TC-18: конец раньше начала — предлагается поменять даты, без подтверждения не создаётся', () => {
    expect(issueOf('хакатон 15.11–13.10')).toEqual({ kind: 'end-before-start' })
    const swapped = ok('хакатон 15.11–13.10', ctx, { swapDates: true })
    expect(swapped.startDate).toBe('2026-10-13')
    expect(swapped.endDate).toBe('2026-11-15')
  })

  it('TC-19: неизвестный предмет — предлагается создать предмет или добавить без него', () => {
    expect(issueOf('хим тест 13.11')).toEqual({ kind: 'unknown-subject', word: 'хим' })
    // без предмета: событие не теряется
    const without = ok('хим тест 13.11', ctx, { acceptUnknownSubject: true })
    expect(without.subjectId).toBeNull()
    expect(without.typeId).toBe(quiz.id)
    expect(without.title).toBe('хим')
    expect(without.startDate).toBe('2026-11-13')
    // создание предмета: после него строка разбирается как обычно
    const chem = subject('Химия', 'хим')
    const created = ok('хим тест 13.11', { ...ctx, subjects: [...ctx.subjects, chem] })
    expect(created.subjectId).toBe(chem.id)
    expect(created.title).toBe('Химия Тест')
  })

  it('TC-22: два события через «;»', () => {
    const results = parseInput('1 матан кр 21.10; 2 матан тест 22.10', ctx)
    expect(results).toHaveLength(2)
    const [first, second] = results.map((r) => (r.result.ok ? r.result.event : null))
    expect(first?.typeId).toBe(kr.id)
    expect(first?.importance).toBe(1)
    expect(first?.startDate).toBe('2026-10-21')
    expect(second?.typeId).toBe(quiz.id)
    expect(second?.importance).toBe(2)
    expect(second?.startDate).toBe('2026-10-22')
  })

  it('TC-23: без типа — бесцветное событие, название из оставшихся слов', () => {
    const e = ok('матан лаба 21.10')
    expect(e.typeId).toBeNull()
    expect(e.importance).toBeNull()
    expect(effective(e)).toBeNull()
    expect(e.subjectId).toBe(matan.id)
    expect(e.title).toBe('лаба')
  })

  it('TC-24: перенос строки работает как «;»', () => {
    const viaSemicolon = parseInput('1 матан кр 21.10; 2 матан тест 22.10', ctx)
    const viaNewline = parseInput('1 матан кр 21.10\n2 матан тест 22.10', ctx)
    expect(viaNewline).toEqual(viaSemicolon)
  })
})

describe('важность в строке (BR-12)', () => {
  it('цифра первым словом или последним после даты', () => {
    expect(ok('2 матан кр 21.10').importance).toBe(2)
    expect(ok('матан кр 21.10 2').importance).toBe(2)
    expect(ok('матан кр 21.10 17:00 2').importance).toBe(2)
  })

  it('цифра в середине — часть названия, не важность', () => {
    const e = ok('матан 2 лаба 21.10')
    expect(e.importance).toBeNull()
    expect(e.title).toBe('2 лаба')
  })

  it('последняя цифра без даты — часть названия', () => {
    const e = ok('матан лаба 2')
    expect(e.importance).toBeNull()
    expect(e.title).toBe('лаба 2')
  })

  it('важность 0 — вне диапазона', () => {
    expect(issueOf('0 матан кр 21.10')).toEqual({ kind: 'importance-out-of-range', value: 0 })
  })
})

describe('даты в строке', () => {
  it('явный год', () => {
    expect(ok('матан кр 21.10.2027').startDate).toBe('2027-10-21')
  })

  it('год берётся из семестра: январь семестра сентябрь–январь — это 2027', () => {
    expect(ok('матан кр 21.01').startDate).toBe('2027-01-21')
    expect(ok('матан кр 5 января').startDate).toBe('2027-01-05')
  })

  it('период через границу года', () => {
    const e = ok('хакатон 20.12-10.01')
    expect(e.startDate).toBe('2026-12-20')
    expect(e.endDate).toBe('2027-01-10')
  })

  it('«сегодня» и «послезавтра»', () => {
    expect(ok('матан кр сегодня').startDate).toBe('2026-10-31')
    expect(ok('матан кр послезавтра').startDate).toBe('2026-11-02')
  })

  it('день недели совпал с сегодняшним: через неделю', () => {
    expect(ok('матан кр сб').startDate).toBe('2026-11-07')
    expect(ok('матан кр вс').startDate).toBe('2026-11-01')
  })

  it('29 февраля в невисокосном году — несуществующая дата', () => {
    expect(issueOf('матан кр 29.02')).toEqual({ kind: 'invalid-date', text: '29.02' })
  })

  it('несуществующий месяц', () => {
    expect(issueOf('матан кр 15.13')).toEqual({ kind: 'invalid-date', text: '15.13' })
  })

  it('несколько отдельных дат — ошибка', () => {
    expect(issueOf('матан кр 21.10 22.10')).toEqual({ kind: 'several-dates' })
  })

  it('несколько дат через запятую только у практики', () => {
    expect(issueOf('матан кр 21.10, 22.10')).toEqual({ kind: 'several-dates' })
  })

  it('практика с периодом — одно окно из двух дат', () => {
    const e = ok('практика матан 10.11-12.11')
    expect(e.startDate).toBe('2026-11-10')
    expect(e.endDate).toBe('2026-11-12')
    expect(e.windows).toEqual([])
  })
})

describe('время', () => {
  it('ЧЧ:ММ, одна цифра часа дополняется нулём', () => {
    expect(ok('матан кр 21.10 9:30').time).toBe('09:30')
  })

  it('неверное время — ошибка', () => {
    expect(issueOf('матан кр 21.10 25:00')).toEqual({ kind: 'invalid-time', text: '25:00' })
    expect(issueOf('матан кр 21.10 12:75')).toEqual({ kind: 'invalid-time', text: '12:75' })
  })
})

describe('название', () => {
  it('слова названия сохраняются как набраны: регистр, знаки', () => {
    expect(ok('матан Лаба №3 21.10').title).toBe('Лаба №3')
  })

  it('слова с дефисом остаются словами', () => {
    expect(ok('матан физ-ра 21.10').title).toBe('физ-ра')
  })

  it('только предмет — название из предмета', () => {
    expect(ok('матан 21.10').title).toBe('Матан')
  })

  it('своё название и тип: название оставшиеся слова, тип по ключевому слову', () => {
    const e = ok('матан кр отчёт 21.10')
    expect(e.typeId).toBe(kr.id)
    expect(e.title).toBe('отчёт')
  })

  it('слово перед ключевым словом типа без предмета предлагается как предмет только до подтверждения', () => {
    expect(issueOf('отчёт кр 21.10')).toEqual({ kind: 'unknown-subject', word: 'отчёт' })
    expect(ok('отчёт кр 21.10', ctx, { acceptUnknownSubject: true }).title).toBe('отчёт')
  })

  it('слово без типа предметом не считается', () => {
    expect(ok('лаба 21.10').title).toBe('лаба')
  })
})

describe('порядок проверки ошибок', () => {
  it('несуществующая дата важнее остальных ошибок', () => {
    expect(issueOf('5 32.10').kind).toBe('invalid-date')
  })

  it('пустая строка: нет названия', () => {
    expect(issueOf('')).toEqual({ kind: 'no-title' })
  })
})

describe('ввод в ячейку: дата ячейки всегда главная', () => {
  const cell = { fixedDate: '2026-10-21' }

  it('нет даты в тексте: событие на дату ячейки, цифра в начале это важность', () => {
    const e = ok('1 КР матан', ctx, cell)
    expect(e.startDate).toBe('2026-10-21')
    expect(e.endDate).toBe('2026-10-21')
    expect(e.importance).toBe(1)
    expect(e.typeId).toBe(kr.id)
    expect(e.subjectId).toBe(matan.id)
    expect(e.title).toBe('Матан КР')
  })

  it('своя дата в тексте игнорируется', () => {
    const e = ok('1 кр матан 25.10', ctx, cell)
    expect(e.startDate).toBe('2026-10-21')
    expect(e.endDate).toBe('2026-10-21')
    expect(e.title).toBe('Матан КР')
  })

  it('цифра после даты в тексте остаётся важностью (BR-12)', () => {
    expect(ok('матан кр 25.10 2', ctx, cell).importance).toBe(2)
  })

  it('неверная дата в тексте не мешает', () => {
    expect(ok('матан кр 32.10', ctx, cell).startDate).toBe('2026-10-21')
  })

  it('период и список дат в тексте не создают окон и не дают ошибок', () => {
    const e = ok('практика сиибд 10.11, 24.11', ctx, cell)
    expect(e.startDate).toBe('2026-10-21')
    expect(e.windows).toEqual([])
  })

  it('время в тексте сохраняется', () => {
    expect(ok('англ тест 17:00', ctx, cell).time).toBe('17:00')
  })

  it('остальные ошибки работают как обычно', () => {
    expect(issueOf('', ctx, cell)).toEqual({ kind: 'no-title' })
    expect(issueOf('5 матан кр', ctx, cell)).toEqual({ kind: 'importance-out-of-range', value: 5 })
    expect(issueOf('хим тест', ctx, cell)).toEqual({ kind: 'unknown-subject', word: 'хим' })
  })

  it('без fixedDate поведение прежнее: без даты — «Когда-нибудь»', () => {
    expect(ok('тест физра').startDate).toBeNull()
  })
})
