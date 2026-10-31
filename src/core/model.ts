// Модель данных. «Семестр» из ТЗ в интерфейсе называется «расписание»:
// у каждого свои даты, свой отсчёт недель и своя ширина столбцов, события принадлежат ему.

import { firstMondayOnOrAfter, validateSemester } from './calendar'
import { isValidIsoDate, weekday, type IsoDate } from './dates'
import { parseHiddenMonths } from './hiddenMonths'
import { parseSchedulePalette, type SchedulePalette } from './schedulePalette'

export const DAYS_IN_ROW = 31
export const DEFAULT_COLUMN_WIDTH = 52
export const MIN_COLUMN_WIDTH = 16
export const MAX_COLUMN_WIDTH = 200
export const DEFAULT_MONTH_COLUMN_WIDTH = 110
export const MIN_MONTH_COLUMN_WIDTH = 60
export const MAX_MONTH_COLUMN_WIDTH = 300
export const MAX_SCHEDULE_NAME_LENGTH = 60
export const DEFAULT_SCHEDULE_NAME = 'Без названия'

export interface Semester {
  id: string
  name: string
  startDate: IsoDate
  endDate: IsoDate
  // Понедельник первой недели; null — первый понедельник на дату начала семестра или позже
  weekOneMonday: IsoDate | null
  // Ширина 31 столбца чисел и колонки месяцев, пиксели
  columnWidths: number[]
  monthColumnWidth: number
  // Скрытые в сетке месяцы («ГГГГ-ММ»); события остаются в базе
  hiddenMonths: string[]
  // Своя палитра расписания; null — общие цвета из настроек
  palette: SchedulePalette | null
  isDemo: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
}

export interface NewSemesterInput {
  id: string
  name: string
  startDate: IsoDate
  endDate: IsoDate
  isDemo?: boolean
}

export function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function clampColumnWidth(value: number): number {
  return clamp(value, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH, DEFAULT_COLUMN_WIDTH)
}

export function clampMonthColumnWidth(value: number): number {
  return clamp(value, MIN_MONTH_COLUMN_WIDTH, MAX_MONTH_COLUMN_WIDTH, DEFAULT_MONTH_COLUMN_WIDTH)
}

// Одинаковая ширина столбцов чисел, чтобы все 31 уместились в окно заданной ширины
export function fitColumnWidth(availableWidth: number, monthColumnWidth: number): number {
  return clampColumnWidth(Math.floor((availableWidth - monthColumnWidth) / DAYS_IN_ROW))
}

export function createSemester(input: NewSemesterInput, now: string): Semester {
  return {
    id: input.id,
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    weekOneMonday: null,
    columnWidths: Array<number>(DAYS_IN_ROW).fill(DEFAULT_COLUMN_WIDTH),
    monthColumnWidth: DEFAULT_MONTH_COLUMN_WIDTH,
    hiddenMonths: [],
    palette: null,
    isDemo: input.isDemo ?? false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readWidths(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== DAYS_IN_ROW) {
    return Array<number>(DAYS_IN_ROW).fill(DEFAULT_COLUMN_WIDTH)
  }
  return value.map((w) => (typeof w === 'number' ? clampColumnWidth(w) : DEFAULT_COLUMN_WIDTH))
}

// Читает запись из хранилища. Без id и без верных дат семестра запись не читается (null),
// остальные испорченные поля заменяются значениями по умолчанию. Саму запись хранилище не трогает.
export function parseSemester(raw: unknown, fallbackNow: string): Semester | null {
  if (!isRecord(raw)) return null
  const { id, startDate, endDate } = raw
  if (typeof id !== 'string' || id === '') return null
  if (typeof startDate !== 'string' || typeof endDate !== 'string') return null
  if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate)) return null
  if (validateSemester(startDate, endDate) !== null) return null

  const weekOne = raw.weekOneMonday
  const weekOneOk = typeof weekOne === 'string' && isValidIsoDate(weekOne) && weekday(weekOne) === 0

  return {
    id,
    name: typeof raw.name === 'string' && raw.name.trim() !== '' ? raw.name : DEFAULT_SCHEDULE_NAME,
    startDate,
    endDate,
    weekOneMonday: weekOneOk ? weekOne : null,
    columnWidths: readWidths(raw.columnWidths),
    monthColumnWidth:
      typeof raw.monthColumnWidth === 'number'
        ? clampMonthColumnWidth(raw.monthColumnWidth)
        : DEFAULT_MONTH_COLUMN_WIDTH,
    hiddenMonths: parseHiddenMonths(raw.hiddenMonths),
    palette: parseSchedulePalette(raw.palette),
    isDemo: raw.isDemo === true,
    archived: raw.archived === true,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : fallbackNow,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : fallbackNow,
  }
}

// Понедельник первой недели с учётом того, что пользователь мог поставить единицу вручную
export function resolveWeekOneMonday(semester: Semester): IsoDate {
  return semester.weekOneMonday ?? firstMondayOnOrAfter(semester.startDate)
}

export type ScheduleNameError = 'empty' | 'too-long'

export function validateScheduleName(name: string): ScheduleNameError | null {
  const trimmed = name.trim()
  if (trimmed === '') return 'empty'
  if (trimmed.length > MAX_SCHEDULE_NAME_LENGTH) return 'too-long'
  return null
}

// Какое расписание открыть: выбранное, если оно есть и не в архиве;
// иначе первое не архивное и не демо; иначе демо; иначе ничего
export function pickActiveId(semesters: Semester[], preferredId: string | null): string | null {
  const available = semesters.filter((s) => !s.archived)
  const preferred = available.find((s) => s.id === preferredId)
  if (preferred) return preferred.id
  const personal = available.find((s) => !s.isDemo)
  return (personal ?? available[0])?.id ?? null
}

// Порядок расписаний в списке: по времени создания, при равенстве личное выше демо, затем по id
export function sortSemesters(semesters: Semester[]): Semester[] {
  return [...semesters].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) ||
      Number(a.isDemo) - Number(b.isDemo) ||
      a.id.localeCompare(b.id),
  )
}
