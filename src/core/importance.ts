// Направление важности (FR-8, GC-16): какая цифра главнее. Цвета от направления не зависят:
// цифра 1 всегда самая яркая, меняется только порядок строк.
// 'min' — главная 1 (по умолчанию), 'max' — главная наибольшая цифра.

export type ImportanceDirection = 'min' | 'max'

export const DEFAULT_DIRECTION: ImportanceDirection = 'min'

// Ключ сортировки: чем меньше, тем главнее. Без важности самый последний.
export function importanceKey(importance: number | null, direction: ImportanceDirection): number {
  if (importance === null) return Number.POSITIVE_INFINITY
  return direction === 'max' ? -importance : importance
}
