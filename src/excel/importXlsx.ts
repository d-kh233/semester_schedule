// Чтение выгрузки Excel обратно: служебные листы превращаются в записи теми же функциями,
// что и при обычной работе (битые строки пропускаются и считаются, остальные загружаются).

import ExcelJS from 'exceljs'
import type { BackupData } from '../core/backup'
import { parseEventType, parseImportanceLevel, parseSubject } from '../core/catalog'
import { parseEvent } from '../core/events'
import { parseSemester } from '../core/model'
import { ru } from '../i18n/ru'

export interface BackupRead {
  data: BackupData
  // Строк, которые не удалось разобрать; их в данные не попало
  skipped: number
}

type Buffer = Parameters<ExcelJS.Workbook['xlsx']['load']>[0]

// Значение ячейки как текст; пустая ячейка — пустая строка
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'text' in value) return String(value.text)
  if (value instanceof Date) return value.toISOString()
  return String(value).trim()
}

// Строки листа без заголовка, каждая ровно из columns ячеек
function rowsOf(ws: ExcelJS.Worksheet, columns: number): string[][] {
  const rows: string[][] = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const values = Array.from({ length: columns }, (_, i) => cellText(row.getCell(i + 1).value))
    if (values.some((v) => v !== '')) rows.push(values)
  })
  return rows
}

const nullable = (v: string): string | null => (v === '' ? null : v)
const number = (v: string): number | null => {
  if (v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
const yes = (v: string): boolean => v === ru.excel.yes
const json = <T>(v: string, fallback: T): T => {
  if (v === '') return fallback
  try {
    return JSON.parse(v) as T
  } catch {
    return fallback
  }
}

// Разбор одного вида записей: сырые строки → записи; непрошедшие пропускаются
function readAll<T>(rows: string[][], toRecord: (row: string[]) => T | null): { items: T[]; skipped: number } {
  const items: T[] = []
  let skipped = 0
  for (const row of rows) {
    const item = toRecord(row)
    if (item === null) skipped++
    else items.push(item)
  }
  return { items, skipped }
}

function sheet(workbook: ExcelJS.Workbook, name: string): ExcelJS.Worksheet {
  const ws = workbook.getWorksheet(name)
  if (!ws) throw new Error(ru.excel.backupMissing)
  return ws
}

// Читает книгу, выгруженную из приложения. Без служебных листов файл не загружается.
export async function readBackupWorkbook(buffer: Buffer, now: string): Promise<BackupRead> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const { sheets, headers } = ru.excel

  const events = readAll(rowsOf(sheet(workbook, sheets.events), headers.events.length), (r) =>
    parseEvent(
      {
        id: r[0],
        semesterId: r[1],
        title: r[2],
        typeId: nullable(r[3]!),
        subjectId: nullable(r[4]!),
        startDate: nullable(r[5]!),
        endDate: nullable(r[6]!),
        time: nullable(r[7]!),
        importance: number(r[8]!),
        lane: number(r[9]!),
        note: r[10],
        done: yes(r[11]!),
        archived: yes(r[12]!),
        windows: json(r[13]!, []),
        createdAt: r[14],
        updatedAt: r[15],
      },
      now,
    ),
  )

  const types = readAll(rowsOf(sheet(workbook, sheets.types), headers.types.length), (r) =>
    parseEventType({
      id: r[0],
      name: r[1],
      keywords: (r[2] ?? '').split(',').map((k) => k.trim()).filter((k) => k !== ''),
      defaultImportance: number(r[3]!),
      color: nullable(r[4]!),
      showAtBottom: yes(r[5]!),
      order: number(r[6]!),
      builtIn: yes(r[7]!),
    }),
  )

  const levels = readAll(rowsOf(sheet(workbook, sheets.levels), headers.levels.length), (r) =>
    parseImportanceLevel({ id: r[0], number: number(r[1]!), name: r[2], color: r[3], order: number(r[4]!) }),
  )

  const subjects = readAll(rowsOf(sheet(workbook, sheets.subjects), headers.subjects.length), (r) =>
    parseSubject({ id: r[0], name: r[1], shortName: r[2], weight: number(r[3]!), demo: yes(r[4]!) }),
  )

  const semesters = readAll(rowsOf(sheet(workbook, sheets.schedules), headers.schedules.length), (r) =>
    parseSemester(
      {
        id: r[0],
        name: r[1],
        startDate: r[2],
        endDate: r[3],
        weekOneMonday: nullable(r[4]!),
        monthColumnWidth: number(r[5]!),
        columnWidths: json(r[6]!, null),
        hiddenMonths: json(r[7]!, []),
        palette: json(r[8]!, null),
        isDemo: yes(r[9]!),
        archived: yes(r[10]!),
        createdAt: r[11],
        updatedAt: r[12],
      },
      now,
    ),
  )

  // Служебный лист нужен, чтобы убедиться, что это выгрузка приложения
  sheet(workbook, sheets.service)

  return {
    data: {
      semesters: semesters.items,
      events: events.items,
      types: types.items,
      levels: levels.items,
      subjects: subjects.items,
    },
    skipped:
      events.skipped + types.skipped + levels.skipped + subjects.skipped + semesters.skipped,
  }
}
