// Превращение разобранных строк в изменения: создать событие или обновить существующее (BR-14)

import { createEvent, type EventRecord } from '../events'
import type { ParsedEvent } from './parse'

export type EventChange =
  | { kind: 'create'; event: EventRecord }
  | { kind: 'update'; before: EventRecord; after: EventRecord }

// Совпали предмет, даты и название (регистр не важен) — это то же событие
export function findMatchingEvent(parsed: ParsedEvent, events: EventRecord[]): EventRecord | null {
  const title = parsed.title.trim().toLowerCase()
  return (
    events.find(
      (e) =>
        !e.archived &&
        e.subjectId === parsed.subjectId &&
        e.startDate === parsed.startDate &&
        e.endDate === parsed.endDate &&
        e.title.trim().toLowerCase() === title,
    ) ?? null
  )
}

const toWindows = (parsed: ParsedEvent) =>
  parsed.windows.map(({ startDate, endDate, planned }) => ({ startDate, endDate, planned }))

// Что изменится. Список событий не меняется: изменения применяет вызывающий код.
export function planChanges(
  parsedList: ParsedEvent[],
  existing: EventRecord[],
  semesterId: string,
  newId: () => string,
  now: string,
): EventChange[] {
  // Рабочая копия: события из этого же ввода тоже могут совпасть друг с другом
  const working = [...existing]
  const changes: EventChange[] = []

  for (const parsed of parsedList) {
    const match = findMatchingEvent(parsed, working)
    if (match) {
      // Обновляется только то, что указано в строке: важность, время, тип, окна
      const after: EventRecord = {
        ...match,
        importance: parsed.importance ?? match.importance,
        time: parsed.time ?? match.time,
        typeId: parsed.typeId ?? match.typeId,
        windows: parsed.windows.length > 0 ? toWindows(parsed) : match.windows,
        updatedAt: now,
      }
      working[working.indexOf(match)] = after
      changes.push({ kind: 'update', before: match, after })
      continue
    }
    const event = createEvent(
      {
        title: parsed.title,
        typeId: parsed.typeId,
        subjectId: parsed.subjectId,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        time: parsed.time,
        importance: parsed.importance,
        note: '',
        done: false,
      },
      { id: newId(), semesterId },
      now,
      toWindows(parsed),
    )
    working.push(event)
    changes.push({ kind: 'create', event })
  }
  return changes
}
