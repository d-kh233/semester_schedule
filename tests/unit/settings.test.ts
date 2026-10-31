import { describe, expect, it } from 'vitest'
import { defaultSettings, parseStoredSettings } from '../../src/core/settings'

describe('parseStoredSettings', () => {
  it('пусто или null: настройки по умолчанию', () => {
    expect(parseStoredSettings(null)).toEqual(defaultSettings)
    expect(parseStoredSettings('')).toEqual(defaultSettings)
  })

  it('битый JSON: настройки по умолчанию, ошибки нет', () => {
    expect(parseStoredSettings('{не json')).toEqual(defaultSettings)
  })

  it('не объект: настройки по умолчанию', () => {
    expect(parseStoredSettings('42')).toEqual(defaultSettings)
    expect(parseStoredSettings('null')).toEqual(defaultSettings)
  })

  it('сохранённые значения читаются', () => {
    const stored = JSON.stringify({
      semesterStart: '2027-02-01',
      semesterEnd: '2027-06-30',
      mutePastDays: false,
      nonexistentDays: 'hidden',
    })
    const result = parseStoredSettings(stored)
    expect(result.semesterStart).toBe('2027-02-01')
    expect(result.semesterEnd).toBe('2027-06-30')
    expect(result.mutePastDays).toBe(false)
    expect(result.nonexistentDays).toBe('hidden')
  })

  it('неверные поля заменяются значениями по умолчанию, верные остаются', () => {
    const stored = JSON.stringify({
      semesterStart: '2027-02-31',
      semesterEnd: '2027-06-30',
      mutePastDays: 'да',
      nonexistentDays: 'что-то',
    })
    const result = parseStoredSettings(stored)
    expect(result.semesterStart).toBe(defaultSettings.semesterStart)
    expect(result.semesterEnd).toBe('2027-06-30')
    expect(result.mutePastDays).toBe(defaultSettings.mutePastDays)
    expect(result.nonexistentDays).toBe(defaultSettings.nonexistentDays)
  })

  it('семестр, где конец раньше начала, заменяется по умолчанию целиком', () => {
    const stored = JSON.stringify({ semesterStart: '2027-06-30', semesterEnd: '2027-02-01' })
    const result = parseStoredSettings(stored)
    expect(result.semesterStart).toBe(defaultSettings.semesterStart)
    expect(result.semesterEnd).toBe(defaultSettings.semesterEnd)
  })

  it('цвета градиента проверяются на формат', () => {
    const stored = JSON.stringify({ weekGradient: { light: 'красный', dark: '#112233' } })
    const result = parseStoredSettings(stored)
    expect(result.weekGradient.light).toBe(defaultSettings.weekGradient.light)
    expect(result.weekGradient.dark).toBe('#112233')
  })

  it('по умолчанию семестр с 1 сентября 2026 по 31 января 2027', () => {
    expect(defaultSettings.semesterStart).toBe('2026-09-01')
    expect(defaultSettings.semesterEnd).toBe('2027-01-31')
  })

  it('по умолчанию 12 цветов месяцев', () => {
    expect(defaultSettings.monthColors).toHaveLength(12)
  })
})
