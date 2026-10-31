// Единственное место, где читаются системные часы. В core/ часов нет.

import { formatIsoDate, type IsoDate } from '../core/dates'

export function todayIso(): IsoDate {
  const now = new Date()
  return formatIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate())
}
