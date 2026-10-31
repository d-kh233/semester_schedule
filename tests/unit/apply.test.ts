import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog, buildLevelsUpTo, createSubject } from '../../src/core/catalog'
import { isCrowdedDate } from '../../src/core/crowded'
import { createEvent, type EventRecord } from '../../src/core/events'
import { planChanges, findMatchingEvent } from '../../src/core/parser/apply'
import {
  parseInputLine,
  type ParseContext,
  type ParsedEvent,
} from '../../src/core/parser/parse'

const NOW = '2026-10-31T12:00:00.000Z'
let n = 0
const newId = () => `id-${++n}`
const { types, levels } = buildDefaultCatalog(newId)
const kr = types.find((t) => t.name === 'КР')!
const matan = createSubject({ name: 'Матан', shortName: 'матан' }, 'sub-matan', false)
const siibd = createSubject({ name: 'СИИБД', shortName: 'сиибд' }, 'sub-siibd', false)

const ctx: ParseContext = {
  today: '2026-10-31',
  semesterStart: '2026-09-01',
  semesterEnd: '2027-01-31',
  levelCount: 3,
  types,
  subjects: [matan, siibd],
  crowdedDays: 7,
}

function parsed(text: string): ParsedEvent {
  const r = parseInputLine(text, ctx)
  if (!r.ok) throw new Error(JSON.stringify(r.issue))
  return r.event
}

function existingMatanKr(patch: Partial<EventRecord> = {}): EventRecord {
  return {
    ...createEvent(
      {
        title: 'Матан КР',
        typeId: kr.id,
        subjectId: matan.id,
        startDate: '2026-10-21',
        endDate: '2026-10-21',
        time: null,
        importance: null,
        note: 'не трогать',
        done: false,
      },
      { id: 'existing', semesterId: 'sem' },
      NOW,
    ),
    ...patch,
  }
}

describe('TC-20, TC-21: правка текстом (BR-14)', () => {
  it('TC-20: совпали предмет, дата и название — событие обновляется, новое не создаётся', () => {
    const existing = existingMatanKr()
    const changes = planChanges([parsed('2 матан кр 21.10')], [existing], 'sem', newId, NOW)
    expect(changes).toHaveLength(1)
    const change = changes[0]!
    expect(change.kind).toBe('update')
    if (change.kind === 'update') {
      expect(change.after.id).toBe('existing')
      expect(change.after.importance).toBe(2)
      // остальное не меняется
      expect(change.after.note).toBe('не трогать')
      expect(change.after.title).toBe('Матан КР')
      expect(change.after.startDate).toBe('2026-10-21')
      expect(change.before.importance).toBeNull()
      expect(change.after.updatedAt).toBe(NOW)
    }
  })

  it('TC-21: другая дата — создаётся новое событие, старое не меняется', () => {
    const existing = existingMatanKr()
    const changes = planChanges([parsed('2 матан кр 22.10')], [existing], 'sem', newId, NOW)
    expect(changes).toHaveLength(1)
    const change = changes[0]!
    expect(change.kind).toBe('create')
    if (change.kind === 'create') {
      expect(change.event.startDate).toBe('2026-10-22')
      expect(change.event.importance).toBe(2)
      expect(change.event.semesterId).toBe('sem')
      expect(change.event.id).not.toBe('existing')
    }
  })

  it('обновляется только то, что указано в строке: время и тип', () => {
    const existing = existingMatanKr({ importance: 3 })
    const changes = planChanges([parsed('матан кр 21.10 17:00')], [existing], 'sem', newId, NOW)
    const change = changes[0]!
    expect(change.kind).toBe('update')
    if (change.kind === 'update') {
      expect(change.after.time).toBe('17:00')
      expect(change.after.importance).toBe(3)
    }
  })

  it('регистр названия не важен при сравнении', () => {
    const existing = existingMatanKr({ title: 'матан кр' })
    expect(findMatchingEvent(parsed('матан кр 21.10'), [existing])?.id).toBe('existing')
  })

  it('событие в архиве или другого предмета не совпадает', () => {
    expect(findMatchingEvent(parsed('матан кр 21.10'), [existingMatanKr({ archived: true })])).toBeNull()
    expect(findMatchingEvent(parsed('сиибд кр 21.10'), [existingMatanKr()])).toBeNull()
  })

  it('событие без даты совпадает только с событием без даты', () => {
    const noDate = existingMatanKr({ startDate: null, endDate: null })
    expect(findMatchingEvent(parsed('матан кр'), [noDate])?.id).toBe('existing')
    expect(findMatchingEvent(parsed('матан кр 21.10'), [noDate])).toBeNull()
  })

  it('два одинаковых события в одном вводе: второе обновляет первое', () => {
    const changes = planChanges(
      [parsed('матан кр 21.10'), parsed('2 матан кр 21.10')],
      [],
      'sem',
      newId,
      NOW,
    )
    expect(changes.map((c) => c.kind)).toEqual(['create', 'update'])
  })

  it('TC-22: два разных события создаются', () => {
    const changes = planChanges(
      [parsed('1 матан кр 21.10'), parsed('2 матан тест 22.10')],
      [],
      'sem',
      newId,
      NOW,
    )
    expect(changes.map((c) => c.kind)).toEqual(['create', 'create'])
  })
})

describe('создание события из разбора', () => {
  it('поля переносятся, заметка пустая, не выполнено, дорожка не назначена', () => {
    const change = planChanges([parsed('1 матан кр 21.10 17:00')], [], 'sem', newId, NOW)[0]!
    expect(change.kind).toBe('create')
    if (change.kind === 'create') {
      const e = change.event
      expect(e.title).toBe('Матан КР')
      expect(e.typeId).toBe(kr.id)
      expect(e.subjectId).toBe(matan.id)
      expect(e.importance).toBe(1)
      expect(e.time).toBe('17:00')
      expect(e.note).toBe('')
      expect(e.done).toBe(false)
      expect(e.archived).toBe(false)
      expect(e.lane).toBeNull()
      expect(e.windows).toEqual([])
    }
  })

  it('TC-8: окна практики сохраняются, ни одна дата не теряется', () => {
    const change = planChanges([parsed('практика сиибд 10.11, 24.11')], [], 'sem', newId, NOW)[0]!
    expect(change.kind).toBe('create')
    if (change.kind === 'create') {
      expect(change.event.windows).toEqual([
        { startDate: '2026-11-10', endDate: '2026-11-10', planned: true },
        { startDate: '2026-11-24', endDate: '2026-11-24', planned: false },
      ])
      expect(change.event.startDate).toBe('2026-11-10')
    }
  })
})

describe('isCrowdedDate (людная неделя, BR-8)', () => {
  it('GC-13: 24.11 при неделе в 7 дней — людное, 23.11 — нет', () => {
    expect(isCrowdedDate('2026-11-24', 7)).toBe(true)
    expect(isCrowdedDate('2026-11-30', 7)).toBe(true)
    expect(isCrowdedDate('2026-11-23', 7)).toBe(false)
    expect(isCrowdedDate('2026-11-10', 7)).toBe(false)
  })

  it('длина людной недели настраивается', () => {
    expect(isCrowdedDate('2026-11-28', 3)).toBe(true)
    expect(isCrowdedDate('2026-11-27', 3)).toBe(false)
    expect(isCrowdedDate('2026-11-29', 2)).toBe(true)
    expect(isCrowdedDate('2026-11-28', 2)).toBe(false)
    expect(isCrowdedDate('2026-11-20', 0)).toBe(false)
  })

  it('месяцы разной длины', () => {
    expect(isCrowdedDate('2026-10-25', 7)).toBe(true)
    expect(isCrowdedDate('2026-10-24', 7)).toBe(false)
    expect(isCrowdedDate('2028-02-23', 7)).toBe(true)
    expect(isCrowdedDate('2028-02-22', 7)).toBe(false)
  })
})

describe('buildLevelsUpTo (создать уровень при вводе больше числа уровней)', () => {
  it('добавляет недостающие уровни до нужного номера', () => {
    const added = buildLevelsUpTo(levels, 5, newId)
    expect(added.map((l) => l.number)).toEqual([4, 5])
    expect(added.map((l) => l.order)).toEqual([4, 5])
    for (const l of added) expect(l.color).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('уровни, которые уже есть, не дублируются', () => {
    expect(buildLevelsUpTo(levels, 3, newId)).toEqual([])
    expect(buildLevelsUpTo(levels, 2, newId)).toEqual([])
  })

  it('слишком большой номер не создаёт уровней', () => {
    expect(buildLevelsUpTo(levels, 50, newId)).toEqual([])
  })
})
