import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog, createSubject } from '../../src/core/catalog'
import {
  buildEventTitle,
  compareEvents,
  completedAtAfterSave,
  createEvent,
  effectiveImportance,
  eventColor,
  isValidTime,
  parseEvent,
  validateEventDraft,
  type EventDraft,
  type EventRecord,
} from '../../src/core/events'

const NOW = '2026-10-31T12:00:00.000Z'
let n = 0
const { types, levels } = buildDefaultCatalog(() => `id-${++n}`)
const kr = types.find((t) => t.name === 'КР')!
const test = types.find((t) => t.name === 'Тест')!
const hackathon = types.find((t) => t.name === 'Хакатон')!
const matan = createSubject({ name: 'Матан', shortName: 'матан' }, 'sub-matan', false)

function draft(patch: Partial<EventDraft> = {}): EventDraft {
  return {
    title: 'Контрольная',
    typeId: null,
    subjectId: null,
    startDate: '2026-10-21',
    endDate: '',
    time: '',
    importance: null,
    note: '',
    done: false,
    ...patch,
  }
}

function event(patch: Partial<EventRecord> = {}): EventRecord {
  return {
    id: 'e',
    semesterId: 's',
    title: 'Событие',
    typeId: null,
    subjectId: null,
    startDate: '2026-10-21',
    endDate: '2026-10-21',
    time: null,
    importance: null,
    lane: null,
    note: '',
    done: false,
    completedAt: null,
    archived: false,
    effort: null,
    windows: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...patch,
  }
}

describe('isValidTime', () => {
  it('ЧЧ:ММ', () => {
    expect(isValidTime('17:00')).toBe(true)
    expect(isValidTime('00:00')).toBe(true)
    expect(isValidTime('23:59')).toBe(true)
  })

  it('неверное время', () => {
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('7:00')).toBe(false)
    expect(isValidTime('17:60')).toBe(false)
    expect(isValidTime('17.00')).toBe(false)
    expect(isValidTime('')).toBe(false)
  })
})

describe('buildEventTitle', () => {
  it('своё название важнее', () => {
    expect(buildEventTitle(' Отчёт ', matan, kr)).toBe('Отчёт')
  })

  it('пустое название строится из предмета и типа: «Матан КР»', () => {
    expect(buildEventTitle('', matan, kr)).toBe('Матан КР')
    expect(buildEventTitle('  ', matan, null)).toBe('Матан')
    expect(buildEventTitle('', null, kr)).toBe('КР')
  })

  it('ничего нет — пустая строка', () => {
    expect(buildEventTitle('', null, null)).toBe('')
  })
})

describe('validateEventDraft', () => {
  it('один день: конец равен началу', () => {
    const result = validateEventDraft(draft(), null, null)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.fields.startDate).toBe('2026-10-21')
      expect(result.fields.endDate).toBe('2026-10-21')
    }
  })

  it('период: даты сохраняются как есть', () => {
    const result = validateEventDraft(draft({ startDate: '2026-10-13', endDate: '2026-11-15' }), null, null)
    expect(result.ok && result.fields.endDate).toBe('2026-11-15')
  })

  it('только конец: начало равно концу (дедлайн привязан к дню конца)', () => {
    const result = validateEventDraft(draft({ startDate: '', endDate: '2026-11-15' }), null, null)
    expect(result.ok && result.fields.startDate).toBe('2026-11-15')
  })

  it('без дат: событие без даты («Когда-нибудь»)', () => {
    const result = validateEventDraft(draft({ startDate: '', endDate: '' }), null, null)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.fields.startDate).toBeNull()
      expect(result.fields.endDate).toBeNull()
    }
  })

  it('нет названия: ошибка, если нельзя построить из предмета и типа', () => {
    expect(validateEventDraft(draft({ title: '  ' }), null, null)).toEqual({
      ok: false,
      error: 'no-title',
    })
    const built = validateEventDraft(draft({ title: '' }), matan, kr)
    expect(built.ok && built.fields.title).toBe('Матан КР')
  })

  it('несуществующая дата', () => {
    expect(validateEventDraft(draft({ startDate: '2026-10-32' }), null, null)).toEqual({
      ok: false,
      error: 'invalid-date',
    })
    expect(validateEventDraft(draft({ endDate: 'завтра' }), null, null)).toEqual({
      ok: false,
      error: 'invalid-date',
    })
  })

  it('конец раньше начала', () => {
    expect(
      validateEventDraft(draft({ startDate: '2026-11-15', endDate: '2026-10-13' }), null, null),
    ).toEqual({ ok: false, error: 'end-before-start' })
  })

  it('неверное время', () => {
    expect(validateEventDraft(draft({ time: '25:00' }), null, null)).toEqual({
      ok: false,
      error: 'invalid-time',
    })
    const ok = validateEventDraft(draft({ time: '17:00' }), null, null)
    expect(ok.ok && ok.fields.time).toBe('17:00')
  })

  it('пустое время — null', () => {
    const result = validateEventDraft(draft({ time: '' }), null, null)
    expect(result.ok && result.fields.time).toBeNull()
  })

  it('тип, предмет, важность и заметка переносятся', () => {
    const result = validateEventDraft(
      draft({ typeId: kr.id, subjectId: matan.id, importance: 3, note: 'взять паспорт', done: true }),
      matan,
      kr,
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.fields.typeId).toBe(kr.id)
      expect(result.fields.subjectId).toBe(matan.id)
      expect(result.fields.importance).toBe(3)
      expect(result.fields.note).toBe('взять паспорт')
      expect(result.fields.done).toBe(true)
    }
  })
})

describe('createEvent', () => {
  it('новое событие: не в архиве, дорожка не назначена', () => {
    const result = validateEventDraft(draft(), null, null)
    if (!result.ok) throw new Error('ожидали успех')
    const e = createEvent(result.fields, { id: 'new', semesterId: 's1' }, NOW)
    expect(e.id).toBe('new')
    expect(e.semesterId).toBe('s1')
    expect(e.archived).toBe(false)
    expect(e.lane).toBeNull()
    expect(e.createdAt).toBe(NOW)
  })
})

describe('effectiveImportance (BR-1, BR-2)', () => {
  it('ручное значение перебивает тип', () => {
    expect(effectiveImportance(event({ importance: 3 }), kr)).toBe(3)
  })

  it('без ручного берётся важность типа', () => {
    expect(effectiveImportance(event(), kr)).toBe(1)
    expect(effectiveImportance(event(), test)).toBe(3)
  })

  it('нет ни ручной, ни у типа — нет важности', () => {
    expect(effectiveImportance(event(), null)).toBeNull()
    expect(effectiveImportance(event(), hackathon)).toBeNull()
  })
})

describe('eventColor (BR-3)', () => {
  it('цвет по важности', () => {
    expect(eventColor(event(), kr, levels)).toBe(levels[0]?.color)
    expect(eventColor(event({ importance: 3 }), kr, levels)).toBe(levels[2]?.color)
  })

  it('без важности и типа — бесцветная ячейка (GC-11)', () => {
    expect(eventColor(event(), null, levels)).toBeNull()
  })

  it('хакатон окрашен цветом своего типа', () => {
    expect(eventColor(event(), hackathon, levels)).toBe(hackathon.color)
  })

  it('важность, которой нет среди уровней: бесцветная', () => {
    expect(eventColor(event({ importance: 9 }), null, levels)).toBeNull()
  })
})

describe('compareEvents (порядок как в BR-4)', () => {
  const sort = (list: EventRecord[]) => [...list].sort((a, b) => compareEvents(a, b, types)).map((e) => e.id)

  it('раньше дата конца выше', () => {
    expect(sort([event({ id: 'b', endDate: '2026-11-01' }), event({ id: 'a', endDate: '2026-10-21' })])).toEqual(['a', 'b'])
  })

  it('при равной дате выше важнее: КР (1) выше практики (2) (GC-4)', () => {
    const practice = types.find((t) => t.name === 'Практика')!
    expect(
      sort([event({ id: 'p', typeId: practice.id }), event({ id: 'k', typeId: kr.id })]),
    ).toEqual(['k', 'p'])
  })

  it('без важности ниже всех при равной дате', () => {
    expect(sort([event({ id: 'none' }), event({ id: 'k', typeId: kr.id })])).toEqual(['k', 'none'])
  })

  it('без даты в конце', () => {
    expect(sort([event({ id: 'no', startDate: null, endDate: null }), event({ id: 'a' })])).toEqual(['a', 'no'])
  })

  it('при полном равенстве раньше созданное выше', () => {
    expect(
      sort([
        event({ id: 'late', createdAt: '2026-10-31T13:00:00.000Z' }),
        event({ id: 'early', createdAt: '2026-10-31T11:00:00.000Z' }),
      ]),
    ).toEqual(['early', 'late'])
  })
})

describe('parseEvent (чтение записи из хранилища)', () => {
  it('верная запись читается без изменений', () => {
    const original = event({ typeId: 'x', time: '17:00', importance: 2, note: 'н', done: true, lane: 3 })
    expect(parseEvent(JSON.parse(JSON.stringify(original)), NOW)).toEqual(original)
  })

  it('без id, расписания или названия — не читается', () => {
    expect(parseEvent(null, NOW)).toBeNull()
    expect(parseEvent({ semesterId: 's', title: 't' }, NOW)).toBeNull()
    expect(parseEvent({ id: 'e', title: 't' }, NOW)).toBeNull()
    expect(parseEvent({ id: 'e', semesterId: 's', title: '  ' }, NOW)).toBeNull()
  })

  it('испорченные поля заменяются по умолчанию, событие не теряется', () => {
    const e = parseEvent(
      {
        id: 'e',
        semesterId: 's',
        title: 'Тест',
        startDate: '2026-02-31',
        endDate: '2026-10-21',
        time: '99:99',
        importance: 'высокая',
        lane: -1,
        done: 'да',
        archived: 1,
        note: 5,
      },
      NOW,
    )
    expect(e).not.toBeNull()
    expect(e?.startDate).toBe('2026-10-21')
    expect(e?.endDate).toBe('2026-10-21')
    expect(e?.time).toBeNull()
    expect(e?.importance).toBeNull()
    expect(e?.lane).toBeNull()
    expect(e?.done).toBe(false)
    expect(e?.archived).toBe(false)
    expect(e?.note).toBe('')
  })

  it('конец раньше начала в записи: даты не теряются, начало приравнивается к концу', () => {
    const e = parseEvent(
      { id: 'e', semesterId: 's', title: 'Т', startDate: '2026-11-15', endDate: '2026-10-13' },
      NOW,
    )
    expect(e?.endDate).toBe('2026-10-13')
    expect(e?.startDate).toBe('2026-10-13')
  })
})

describe('объём и дата выполнения (поля для версий 2 и 3)', () => {
  const TODAY = '2026-10-31'

  it('новое событие: объём не указан, дата выполнения пустая', () => {
    const e = createEvent(
      { title: 'КР', typeId: null, subjectId: null, startDate: '2026-10-21', endDate: '2026-10-21', time: null, importance: null, note: '', done: false },
      { id: 'a', semesterId: 's' },
      NOW,
    )
    expect(e.effort).toBeNull()
    expect(e.completedAt).toBeNull()
  })

  it('отметка «выполнено» ставит сегодняшнюю дату', () => {
    const before = event({ done: false, completedAt: null })
    const after = { ...before, done: true }
    expect(completedAtAfterSave(before, after, TODAY)).toBe(TODAY)
  })

  it('новое событие, сразу выполненное, получает сегодняшнюю дату', () => {
    expect(completedAtAfterSave(null, event({ done: true }), TODAY)).toBe(TODAY)
  })

  it('правка выполненного события сохраняет прежнюю дату выполнения', () => {
    const before = event({ done: true, completedAt: '2026-10-20' })
    const after = { ...before, title: 'Новое название' }
    expect(completedAtAfterSave(before, after, TODAY)).toBe('2026-10-20')
  })

  it('выполненное без даты (старые записи) остаётся без даты', () => {
    const before = event({ done: true, completedAt: null })
    expect(completedAtAfterSave(before, before, TODAY)).toBeNull()
  })

  it('снятая отметка очищает дату выполнения', () => {
    const before = event({ done: true, completedAt: '2026-10-20' })
    const after = { ...before, done: false }
    expect(completedAtAfterSave(before, after, TODAY)).toBeNull()
  })

  it('чтение записи: верный объём и дата сохраняются', () => {
    const e = parseEvent({ ...event(), effort: 'heavy', completedAt: '2026-10-20' }, NOW)
    expect(e?.effort).toBe('heavy')
    expect(e?.completedAt).toBe('2026-10-20')
  })

  it('чтение записи: неизвестный объём и битая дата заменяются пустыми значениями', () => {
    const e = parseEvent({ ...event(), effort: 'огромное', completedAt: '32.13.2026' }, NOW)
    expect(e?.effort).toBeNull()
    expect(e?.completedAt).toBeNull()
  })

  it('чтение старой записи без новых полей: объём и дата пустые, событие не теряется', () => {
    const old: Record<string, unknown> = { ...event() }
    delete old.effort
    delete old.completedAt
    const e = parseEvent(old, NOW)
    expect(e).not.toBeNull()
    expect(e?.effort).toBeNull()
    expect(e?.completedAt).toBeNull()
  })
})
