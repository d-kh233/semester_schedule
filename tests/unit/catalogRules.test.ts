import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog, parseEventType, type EventType, type ImportanceLevel } from '../../src/core/catalog'
import {
  canDeleteLevel,
  canDeleteType,
  isBuiltInLevel,
  parseKeywords,
  validateKeywords,
  validateLevelName,
  validateTypeName,
} from '../../src/core/catalogRules'
import { createEvent, type EventRecord } from '../../src/core/events'

let n = 0
const newId = () => `id-${++n}`
const { types, levels } = buildDefaultCatalog(newId)
const kr = types.find((t) => t.name === 'КР')!
const hackathon = types.find((t) => t.name === 'Хакатон')!

const userType: EventType = {
  id: 'my',
  name: 'Лаба',
  keywords: ['лаба'],
  defaultImportance: 2,
  color: null,
  showAtBottom: false,
  order: 10,
  builtIn: false,
}

function eventWith(typeId: string | null, importance: number | null = null): EventRecord {
  return createEvent(
    {
      title: 'x',
      typeId,
      subjectId: null,
      startDate: '2026-11-01',
      endDate: '2026-11-01',
      time: null,
      importance,
      note: '',
      done: false,
    },
    { id: `e${++n}`, semesterId: 'sem' },
    '2026-10-31T00:00:00.000Z',
  )
}

describe('стандартные типы и уровни (нельзя удалить, можно переименовать)', () => {
  it('все стандартные типы помечены builtIn', () => {
    for (const t of types) expect(t.builtIn).toBe(true)
  })

  it('уровни 1–3 стандартные, 4 и выше созданы пользователем', () => {
    expect(isBuiltInLevel({ number: 1 } as ImportanceLevel)).toBe(true)
    expect(isBuiltInLevel({ number: 3 } as ImportanceLevel)).toBe(true)
    expect(isBuiltInLevel({ number: 4 } as ImportanceLevel)).toBe(false)
  })

  it('стандартный тип нельзя удалить, даже если он не используется и переименован', () => {
    expect(canDeleteType(kr, [])).toEqual({ ok: false, reason: 'built-in' })
    expect(canDeleteType({ ...kr, name: 'Лаба' }, [])).toEqual({ ok: false, reason: 'built-in' })
  })

  it('стандартный уровень 1–3 нельзя удалить', () => {
    expect(canDeleteLevel(levels[0]!, [])).toEqual({ ok: false, reason: 'built-in' })
  })

  it('старая запись без флага builtIn: стандартный по названию, пользовательский нет', () => {
    const old = parseEventType({ id: 'o', name: 'Тест', keywords: ['тест'], order: 3 })
    expect(old?.builtIn).toBe(true)
    const mine = parseEventType({ id: 'm', name: 'Лаба', keywords: ['лаба'] })
    expect(mine?.builtIn).toBe(false)
  })
})

describe('удаление пользовательского типа и уровня', () => {
  it('пользовательский тип без событий можно удалить', () => {
    expect(canDeleteType(userType, [])).toEqual({ ok: true })
  })

  it('тип, которым пользуется событие (в том числе в архиве), удалить нельзя', () => {
    const archived = { ...eventWith(userType.id), archived: true }
    expect(canDeleteType(userType, [archived])).toEqual({ ok: false, reason: 'in-use' })
  })

  it('уровень, на который ссылается событие, удалить нельзя', () => {
    const level: ImportanceLevel = { id: 'l4', number: 4, name: 'Важность 4', color: '#111111', order: 4 }
    expect(canDeleteLevel(level, [eventWith(null, 4)])).toEqual({ ok: false, reason: 'in-use' })
    expect(canDeleteLevel(level, [eventWith(null, 2)])).toEqual({ ok: true })
  })

  it('тип, который задаёт важность по умолчанию для событий, тоже считается использованием', () => {
    const level: ImportanceLevel = { id: 'l4', number: 4, name: 'Важность 4', color: '#111111', order: 4 }
    const typeWith4 = { ...userType, defaultImportance: 4 }
    expect(canDeleteLevel(level, [], [typeWith4])).toEqual({ ok: false, reason: 'in-use' })
  })

  it('хакатон (стандартный) в списке всё равно нельзя удалить', () => {
    expect(canDeleteType(hackathon, [])).toEqual({ ok: false, reason: 'built-in' })
  })
})

describe('название типа и уровня', () => {
  it('пустое название нельзя', () => {
    expect(validateTypeName('  ', types)).toBe('empty')
    expect(validateLevelName('')).toBe('empty')
  })

  it('название типа не повторяется, регистр не важен; при правке своё имя не повтор', () => {
    expect(validateTypeName('кр', types)).toBe('duplicate')
    expect(validateTypeName('КР', types, kr.id)).toBeNull()
  })

  it('нормальное название', () => {
    expect(validateTypeName('Лабораторная', types)).toBeNull()
    expect(validateLevelName('Срочно')).toBeNull()
  })
})

describe('ключевые слова типа (ввод в строке)', () => {
  it('разбор: через запятую, строчными, без пустых и повторов', () => {
    expect(parseKeywords(' Лаб, лаба ,, ЛР ')).toEqual(['лаб', 'лаба', 'лр'])
  })

  it('пустой список нельзя: без слова тип не узнаётся', () => {
    expect(validateKeywords([], types)).toBe('empty')
  })

  it('слово с пробелом нельзя', () => {
    expect(validateKeywords(['лаб работа'], types)).toBe('spaces')
  })

  it('слово, уже занятое другим типом, нельзя', () => {
    expect(validateKeywords(['кр'], types)).toBe('duplicate')
    expect(validateKeywords(['кр'], types, kr.id)).toBeNull()
  })
})
