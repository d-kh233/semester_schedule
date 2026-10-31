// Примеры для демо-расписания: по мотивам тест-кейсов ТЗ и таблицы заказчицы

import { createSubject, type EventType, type Subject } from './catalog'
import { formatIsoDate, parseIsoDate, type IsoDate } from './dates'
import { createEvent, type EventFields, type EventRecord } from './events'

interface DemoInput {
  semesterId: string
  types: EventType[]
  // Дата начала демо-семестра: от неё берётся год примеров
  startDate: IsoDate
  newId: () => string
  now: string
}

export function buildDemoData(input: DemoInput): { subjects: Subject[]; events: EventRecord[] } {
  const { semesterId, types, newId, now } = input
  const year = parseIsoDate(input.startDate).year
  const day = (month: number, d: number): IsoDate => formatIsoDate(year, month, d)

  const subjectNames: [string, string, number][] = [
    ['Матан', 'матан', 3],
    ['Англ. яз.', 'англ', 2],
    ['СИИБД', 'сиибд', 3],
    ['Физра', 'физра', 1],
  ]
  const subjects = subjectNames.map(([name, shortName, weight]) => ({
    ...createSubject({ name, shortName }, newId(), true),
    weight,
  }))
  const subjectId = (shortName: string) => subjects.find((s) => s.shortName === shortName)?.id ?? null
  const typeId = (name: string) => types.find((t) => t.name === name)?.id ?? null

  const base = {
    typeId: null,
    subjectId: null,
    startDate: null,
    endDate: null,
    time: null,
    importance: null,
    note: '',
    done: false,
  } satisfies Omit<EventFields, 'title'>

  const examples: EventFields[] = [
    { ...base, title: 'Матан КР', typeId: typeId('КР'), subjectId: subjectId('матан'), startDate: day(10, 21), endDate: day(10, 21) },
    { ...base, title: 'СИИБД КР', typeId: typeId('КР'), subjectId: subjectId('сиибд'), startDate: day(10, 21), endDate: day(10, 21), importance: 3 },
    { ...base, title: 'Лаба', subjectId: subjectId('матан'), startDate: day(10, 28), endDate: day(11, 3) },
    { ...base, title: 'Хакатон', typeId: typeId('Хакатон'), startDate: day(10, 13), endDate: day(11, 15) },
    { ...base, title: 'СИИБД РТ 3,4', typeId: typeId('Практика'), subjectId: subjectId('сиибд'), startDate: day(11, 10), endDate: day(11, 10) },
    { ...base, title: 'Англ. яз. тест', typeId: typeId('Тест'), subjectId: subjectId('англ'), startDate: day(11, 13), endDate: day(11, 13), time: '17:00' },
    { ...base, title: 'Англ. яз. КР', typeId: typeId('КР'), subjectId: subjectId('англ'), startDate: day(12, 12), endDate: day(12, 12) },
    { ...base, title: 'Матан КР', typeId: typeId('КР'), subjectId: subjectId('матан'), startDate: day(12, 14), endDate: day(12, 14), done: true },
    { ...base, title: 'Подготовка к экзаменам', typeId: typeId('Подготовка к экзаменам'), startDate: day(12, 15), endDate: day(12, 31) },
    { ...base, title: 'Физра тест', typeId: typeId('Тест'), subjectId: subjectId('физра') },
  ]

  const events = examples.map((fields) => createEvent(fields, { id: newId(), semesterId }, now))
  return { subjects, events }
}
