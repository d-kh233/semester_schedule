import { describe, expect, it } from 'vitest'
import { buildDefaultCatalog, createSubject } from '../../src/core/catalog'
import { createEvent, type EventRecord } from '../../src/core/events'
import { createSemester, type Semester } from '../../src/core/model'
import { defaultSettings } from '../../src/core/settings'
import { buildExportWorkbook, type ExportData } from '../../src/excel/exportXlsx'
import { readBackupWorkbook } from '../../src/excel/importXlsx'
import { ru } from '../../src/i18n/ru'

let n = 0
const { types, levels } = buildDefaultCatalog(() => `id-${++n}`)
const kr = types.find((t) => t.name === 'КР')!
const practice = types.find((t) => t.name === 'Практика')!

const main: Semester = {
  ...createSemester({ id: 'main', name: 'Осень', startDate: '2026-09-01', endDate: '2027-01-31' }, '2026-09-01T00:00:00.000Z'),
  columnWidths: Array<number>(31).fill(54),
  hiddenMonths: ['2026-12'],
  palette: null,
}
const subject = createSubject({ name: 'Матан', shortName: 'матан' }, 'sub-matan', false)

function event(overrides: Partial<EventRecord>): EventRecord {
  return {
    ...createEvent(
      {
        title: 'Матан КР',
        typeId: kr.id,
        subjectId: subject.id,
        startDate: '2026-10-21',
        endDate: '2026-10-21',
        time: '17:00',
        importance: 2,
        note: 'не забыть',
        done: false,
      },
      { id: `e-${++n}`, semesterId: main.id },
      '2026-10-01T00:00:00.000Z',
    ),
    ...overrides,
  }
}

const events: EventRecord[] = [
  event({ id: 'e-kr', lane: 0 }),
  event({
    id: 'e-practice',
    title: 'Практика 2',
    typeId: practice.id,
    startDate: '2026-11-10',
    endDate: '2026-11-24',
    time: null,
    importance: null,
    done: true,
    windows: [
      { startDate: '2026-11-10', endDate: '2026-11-10', planned: true },
      { startDate: '2026-11-24', endDate: '2026-11-24', planned: false },
    ],
  }),
  event({ id: 'e-old', archived: true, startDate: null, endDate: null, subjectId: null }),
]

const data: ExportData = {
  semesters: [main],
  events,
  types,
  levels,
  subjects: [subject],
  settings: defaultSettings,
  scheduleIds: [main.id],
  includeService: true,
  exportedAt: '2026-11-01T12:00:00.000Z',
}

async function roundTrip() {
  const buffer = await buildExportWorkbook(data).xlsx.writeBuffer()
  return readBackupWorkbook(buffer, '2026-11-01T12:00:00.000Z')
}

describe('выгрузка и загрузка обратно: данные совпадают (GC-10)', () => {
  it('события возвращаются такими же, включая архив, окна и выполненные', async () => {
    const { data: back, skipped } = await roundTrip()
    expect(skipped).toBe(0)
    expect(back.events).toEqual(events)
  })

  it('типы, уровни, предметы и расписание возвращаются такими же', async () => {
    const { data: back } = await roundTrip()
    expect(back.types).toEqual(types)
    expect(back.levels).toEqual(levels)
    expect(back.subjects).toEqual([subject])
    expect(back.semesters).toEqual<Semester[]>([main])
  })

  it('файл без служебных листов не загружается, понятная ошибка', async () => {
    const wb = buildExportWorkbook({ ...data, includeService: false })
    const buffer = await wb.xlsx.writeBuffer()
    await expect(readBackupWorkbook(buffer, '2026-11-01T12:00:00.000Z')).rejects.toThrow(ru.excel.backupMissing)
  })
})
