import { describe, expect, it } from 'vitest'
import { buildCalendar } from '../../src/core/calendar'
import { buildDefaultCatalog, type Subject } from '../../src/core/catalog'
import { createEvent } from '../../src/core/events'
import { blockLabel, buildMonthLayouts } from '../../src/core/gridBlocks'
import { placeLanes } from '../../src/core/layout'

const english: Subject = { id: 's1', name: 'Англ. яз.', shortName: 'англ', weight: 1, demo: false }

describe('короткая подпись блока', () => {
  it('имя предмета в начале названия заменяется коротким именем', () => {
    expect(blockLabel('Англ. яз. КР', english)).toBe('Англ КР')
  })

  it('регистр начала названия не важен', () => {
    expect(blockLabel('англ. яз. тест', english)).toBe('Англ тест')
  })

  it('название без имени предмета остаётся как есть', () => {
    expect(blockLabel('СИИБД РТ 3,4', english)).toBe('СИИБД РТ 3,4')
  })

  it('без предмета название не меняется', () => {
    expect(blockLabel('Англ. яз. КР', null)).toBe('Англ. яз. КР')
  })

  it('имя предмета как часть слова не заменяется', () => {
    expect(blockLabel('Англ. яз.ык', english)).toBe('Англ. яз.ык')
  })

  it('если короткое имя отличается от полного только регистром, название не меняется', () => {
    const siibd: Subject = { id: 's2', name: 'СИИБД', shortName: 'сиибд', weight: 1, demo: false }
    expect(blockLabel('СИИБД РТ 3,4', siibd)).toBe('СИИБД РТ 3,4')
  })

  it('если название целиком равно имени предмета, остаётся короткое имя', () => {
    expect(blockLabel('Англ. яз.', english)).toBe('Англ')
  })
})

describe('подпись блока в сетке', () => {
  it('блок события с предметом получает короткую подпись, tooltip хранит полное название через title события', () => {
    const { types, levels } = buildDefaultCatalog(() => 'x')
    const event = createEvent(
      {
        title: 'Англ. яз. КР',
        typeId: null,
        subjectId: 's1',
        startDate: '2026-10-21',
        endDate: '2026-10-21',
        time: null,
        importance: null,
        note: '',
        done: false,
      },
      { id: 'e1', semesterId: 'sem' },
      '2026-10-01T00:00:00.000Z',
    )
    const placed = placeLanes([event], types, '2026-10-31T12:00:00.000Z').events
    const layouts = buildMonthLayouts({
      months: buildCalendar('2026-10-01', '2026-10-31'),
      events: placed,
      types,
      levels,
      subjects: [english],
      today: '2026-10-31',
      crowdedDays: 7,
    })
    const shown = layouts[0]?.blocks[0]
    expect(shown?.label).toBe('Англ КР')
    expect(shown?.fullTitle).toBe('Англ. яз. КР')
  })
})
