import { describe, expect, it } from 'vitest'
import {
  buildDefaultCatalog,
  createSubject,
  isValidWeight,
  parseEventType,
  parseImportanceLevel,
  parseSubject,
  sortLevels,
  sortSubjects,
  sortTypes,
  validateSubject,
  type Subject,
} from '../../src/core/catalog'

function counter() {
  let n = 0
  return () => `id-${++n}`
}

function subject(id: string, shortName: string, name = shortName): Subject {
  return createSubject({ name, shortName }, id, false)
}

describe('buildDefaultCatalog (BR-1, BR-7)', () => {
  const { types, levels } = buildDefaultCatalog(counter())

  it('три уровня важности 1, 2, 3 по порядку', () => {
    expect(levels.map((l) => l.number)).toEqual([1, 2, 3])
    expect(levels.map((l) => l.order)).toEqual([1, 2, 3])
    for (const level of levels) expect(level.color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('типы по умолчанию: КР 1, практика 2, тест 3', () => {
    const byName = (name: string) => types.find((t) => t.name === name)
    expect(byName('КР')?.defaultImportance).toBe(1)
    expect(byName('Практика')?.defaultImportance).toBe(2)
    expect(byName('Тест')?.defaultImportance).toBe(3)
    expect(byName('КР')?.keywords).toEqual(['кр'])
    expect(byName('Практика')?.keywords).toEqual(['практика'])
    expect(byName('Тест')?.keywords).toEqual(['тест'])
  })

  it('хакатон и подготовка к экзаменам: без важности, со своим цветом, показываются внизу', () => {
    for (const name of ['Хакатон', 'Подготовка к экзаменам']) {
      const type = types.find((t) => t.name === name)
      expect(type?.defaultImportance).toBeNull()
      expect(type?.color).toMatch(/^#[0-9a-f]{6}$/)
      expect(type?.showAtBottom).toBe(true)
    }
    expect(types.find((t) => t.name === 'Хакатон')?.keywords).toEqual(['хакатон'])
  })

  it('КР, практика и тест не показываются внизу и без своего цвета', () => {
    for (const name of ['КР', 'Практика', 'Тест']) {
      const type = types.find((t) => t.name === name)
      expect(type?.showAtBottom).toBe(false)
      expect(type?.color).toBeNull()
    }
  })

  it('у всех типов и уровней разные id', () => {
    const ids = [...types.map((t) => t.id), ...levels.map((l) => l.id)]
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('validateSubject', () => {
  const existing = [subject('1', 'матан', 'Матан')]

  it('нормальный предмет', () => {
    expect(validateSubject({ name: 'Физра', shortName: 'физра' }, existing)).toBeNull()
  })

  it('пустое полное или короткое имя', () => {
    expect(validateSubject({ name: '  ', shortName: 'физра' }, existing)).toBe('name-empty')
    expect(validateSubject({ name: 'Физра', shortName: '' }, existing)).toBe('short-empty')
  })

  it('короткое имя с пробелом нельзя (иначе оно не распознается в строке ввода)', () => {
    expect(validateSubject({ name: 'Физра', shortName: 'физ ра' }, existing)).toBe('short-spaces')
  })

  it('короткое имя не повторяется, регистр не важен', () => {
    expect(validateSubject({ name: 'Матан 2', shortName: 'МАТАН' }, existing)).toBe(
      'short-duplicate',
    )
  })

  it('при правке своё же короткое имя не считается повтором', () => {
    expect(validateSubject({ name: 'Матан', shortName: 'матан' }, existing, '1')).toBeNull()
  })
})

describe('createSubject', () => {
  it('убирает лишние пробелы, вес по умолчанию 1', () => {
    const s = createSubject({ name: '  Англ. яз. ', shortName: ' англ ' }, 'x', false)
    expect(s.name).toBe('Англ. яз.')
    expect(s.shortName).toBe('англ')
    expect(s.weight).toBe(1)
    expect(s.demo).toBe(false)
  })
})

describe('чтение записей из хранилища', () => {
  it('предмет: без id или имён не читается, вес и флаги по умолчанию', () => {
    expect(parseSubject(null)).toBeNull()
    expect(parseSubject({ name: 'a', shortName: 'a' })).toBeNull()
    expect(parseSubject({ id: 'x', name: '', shortName: 'a' })).toBeNull()
    const s = parseSubject({ id: 'x', name: 'Матан', shortName: 'матан', weight: 'много', demo: 1 })
    expect(s?.weight).toBe(1)
    expect(s?.demo).toBe(false)
  })

  it('тип события: испорченные поля заменяются, без id и названия не читается', () => {
    expect(parseEventType({ id: 'x' })).toBeNull()
    const t = parseEventType({
      id: 't',
      name: 'КР',
      keywords: ['кр', 5],
      defaultImportance: 'один',
      color: 'красный',
      showAtBottom: 'да',
    })
    expect(t?.keywords).toEqual(['кр'])
    expect(t?.defaultImportance).toBeNull()
    expect(t?.color).toBeNull()
    expect(t?.showAtBottom).toBe(false)
  })

  it('уровень важности: номер должен быть целым от 1', () => {
    expect(parseImportanceLevel({ id: 'l', number: 0, name: 'x', color: '#ffffff', order: 1 })).toBeNull()
    expect(parseImportanceLevel({ id: 'l', number: 2, name: 'x', color: 'белый', order: 2 })?.color).toBe(
      '#cccccc',
    )
  })
})

describe('порядок справочников', () => {
  it('типы по умолчанию идут в порядке КР, Практика, Тест, Хакатон, Подготовка', () => {
    const { types } = buildDefaultCatalog(counter())
    expect(types.map((t) => t.order)).toEqual([1, 2, 3, 4, 5])
    const shuffled = [types[3]!, types[0]!, types[4]!, types[2]!, types[1]!]
    expect(sortTypes(shuffled).map((t) => t.name)).toEqual([
      'КР',
      'Практика',
      'Тест',
      'Хакатон',
      'Подготовка к экзаменам',
    ])
  })

  it('тип без номера порядка идёт в конец', () => {
    const t = parseEventType({ id: 't', name: 'Свой' })
    expect(t?.order).toBe(999)
  })

  it('уровни по порядку', () => {
    const { levels } = buildDefaultCatalog(counter())
    expect(sortLevels([levels[2]!, levels[0]!, levels[1]!]).map((l) => l.number)).toEqual([1, 2, 3])
  })

  it('предметы по алфавиту, регистр не важен, исходный список не меняется', () => {
    const list = [
      createSubject({ name: 'Физра', shortName: 'физра' }, '4', false),
      createSubject({ name: 'матан', shortName: 'ма' }, '2', false),
      createSubject({ name: 'Англ. яз.', shortName: 'англ' }, '1', false),
      createSubject({ name: 'СИИБД', shortName: 'сиибд' }, '3', false),
    ]
    expect(sortSubjects(list).map((s) => s.name)).toEqual(['Англ. яз.', 'матан', 'СИИБД', 'Физра'])
    expect(list.map((s) => s.id)).toEqual(['4', '2', '1', '3'])
  })
})


describe('isValidWeight (вес предмета)', () => {
  it('целое от 1 до 10', () => {
    expect(isValidWeight(1)).toBe(true)
    expect(isValidWeight(10)).toBe(true)
    expect(isValidWeight(0)).toBe(false)
    expect(isValidWeight(11)).toBe(false)
    expect(isValidWeight(2.5)).toBe(false)
    expect(isValidWeight(Number.NaN)).toBe(false)
  })
})
