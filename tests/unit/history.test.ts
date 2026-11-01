import { describe, expect, it } from 'vitest'
import {
  applyChanges,
  diffEvents,
  HISTORY_LIMIT,
  pushHistory,
  type HistoryEntry,
} from '../../src/core/history'
import type { EventRecord } from '../../src/core/events'

const NOW = '2026-10-31T12:00:00.000Z'

function event(patch: Partial<EventRecord> = {}): EventRecord {
  return {
    id: 'e1',
    semesterId: 's',
    title: 'КР',
    typeId: null,
    subjectId: null,
    startDate: '2026-10-21',
    endDate: '2026-10-21',
    time: null,
    importance: 1,
    lane: 0,
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

describe('diffEvents (что изменилось между двумя состояниями)', () => {
  it('без изменений пусто', () => {
    const list = [event()]
    expect(diffEvents(list, list)).toEqual([])
  })

  it('новое событие: до — пусто, после — запись', () => {
    const created = event({ id: 'new' })
    expect(diffEvents([], [created])).toEqual([{ id: 'new', before: null, after: created }])
  })

  it('удалённое событие: до — запись, после — пусто', () => {
    const old = event()
    expect(diffEvents([old], [])).toEqual([{ id: 'e1', before: old, after: null }])
  })

  it('изменённая дорожка попадает в журнал (GC-8 держится на дорожке)', () => {
    const before = event({ lane: 0 })
    const after = event({ lane: 2 })
    expect(diffEvents([before], [after])).toEqual([{ id: 'e1', before, after }])
  })
})

describe('applyChanges (вернуть или повторить)', () => {
  const created = event({ id: 'new' })
  const created2 = event({ id: 'new', title: 'Правка' })

  it('отмена создания убирает событие, повтор возвращает', () => {
    const changes = diffEvents([], [created])
    expect(applyChanges([created], changes, 'before')).toEqual([])
    expect(applyChanges([], changes, 'after')).toEqual([created])
  })

  it('отмена правки возвращает прежнюю запись целиком, включая дорожку', () => {
    const before = event({ lane: 0, title: 'Старое' })
    const after = event({ lane: 3, title: 'Новое' })
    const changes = diffEvents([before], [after])
    expect(applyChanges([after], changes, 'before')).toEqual([before])
    expect(applyChanges([before], changes, 'after')).toEqual([after])
  })

  it('отмена удаления возвращает событие на ту же дорожку (GC-8)', () => {
    const other = event({ id: 'other', lane: 1 })
    const old = event({ id: 'gone', lane: 2 })
    const changes = diffEvents([other, old], [other])
    expect(applyChanges([other], changes, 'before')).toEqual([other, old])
  })

  it('не трогает события, которых нет в журнале', () => {
    const unrelated = event({ id: 'x' })
    const changes = diffEvents([], [created2])
    expect(applyChanges([unrelated], changes, 'before')).toEqual([unrelated])
  })
})

describe('pushHistory (стек отмены)', () => {
  const entry: HistoryEntry = { changes: [] }

  it('добавляет запись наверх', () => {
    const stack = pushHistory([entry], { changes: [{ id: 'a', before: null, after: null }] })
    expect(stack).toHaveLength(2)
    expect(stack[1]!.changes[0]!.id).toBe('a')
  })

  it('обрезает старые записи, не больше HISTORY_LIMIT', () => {
    let stack: HistoryEntry[] = []
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) {
      stack = pushHistory(stack, { changes: [{ id: String(i), before: null, after: null }] })
    }
    expect(stack).toHaveLength(HISTORY_LIMIT)
    expect(stack[0]!.changes[0]!.id).toBe('5')
  })
})
