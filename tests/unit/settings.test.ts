import { describe, expect, it } from 'vitest'
import {
  defaultSemesterDates,
  defaultSettings,
  parseLegacySettings,
  parseSettings,
} from '../../src/core/settings'

describe('parseLegacySettings (настройки шага 2 из localStorage)', () => {
  it('пусто или null: настройки по умолчанию', () => {
    expect(parseLegacySettings(null).settings).toEqual(defaultSettings)
    expect(parseLegacySettings('').settings).toEqual(defaultSettings)
  })

  it('битый JSON: настройки по умолчанию, ошибки нет', () => {
    expect(parseLegacySettings('{не json').settings).toEqual(defaultSettings)
  })

  it('не объект: настройки по умолчанию', () => {
    expect(parseLegacySettings('42').settings).toEqual(defaultSettings)
    expect(parseLegacySettings('null').settings).toEqual(defaultSettings)
  })

  it('сохранённые значения читаются', () => {
    const stored = JSON.stringify({
      semesterStart: '2027-02-01',
      semesterEnd: '2027-06-30',
      mutePastDays: false,
      nonexistentDays: 'hidden',
    })
    const result = parseLegacySettings(stored)
    expect(result.semesterStart).toBe('2027-02-01')
    expect(result.semesterEnd).toBe('2027-06-30')
    expect(result.settings.mutePastDays).toBe(false)
    expect(result.settings.nonexistentDays).toBe('hidden')
  })

  it('неверные поля заменяются значениями по умолчанию, верные остаются', () => {
    const stored = JSON.stringify({
      semesterStart: '2027-02-31',
      semesterEnd: '2027-06-30',
      mutePastDays: 'да',
      nonexistentDays: 'что-то',
    })
    const result = parseLegacySettings(stored)
    expect(result.semesterStart).toBe(defaultSemesterDates.start)
    expect(result.semesterEnd).toBe('2027-06-30')
    expect(result.settings.mutePastDays).toBe(defaultSettings.mutePastDays)
    expect(result.settings.nonexistentDays).toBe(defaultSettings.nonexistentDays)
  })

  it('семестр, где конец раньше начала, заменяется по умолчанию целиком', () => {
    const stored = JSON.stringify({ semesterStart: '2027-06-30', semesterEnd: '2027-02-01' })
    const result = parseLegacySettings(stored)
    expect(result.semesterStart).toBe(defaultSemesterDates.start)
    expect(result.semesterEnd).toBe(defaultSemesterDates.end)
  })

  it('цвета градиента проверяются на формат', () => {
    const stored = JSON.stringify({ weekGradient: { light: 'красный', dark: '#112233' } })
    const result = parseLegacySettings(stored)
    expect(result.settings.weekGradient.light).toBe(defaultSettings.weekGradient.light)
    expect(result.settings.weekGradient.dark).toBe('#112233')
  })
})

describe('parseSettings (запись из IndexedDB)', () => {
  it('не объект: по умолчанию', () => {
    expect(parseSettings(undefined)).toEqual(defaultSettings)
    expect(parseSettings('x')).toEqual(defaultSettings)
  })

  it('полные верные настройки читаются без изменений', () => {
    const custom = {
      ...defaultSettings,
      mutePastDays: false,
      nonexistentDays: 'hidden' as const,
      weekGradient: { light: '#ffffff', dark: '#000000' },
    }
    expect(parseSettings(JSON.parse(JSON.stringify(custom)))).toEqual(custom)
  })

  it('цвета месяцев: неверный заменяется по месту, остальные остаются', () => {
    const colors = [...defaultSettings.monthColors]
    colors[3] = 'розовый'
    colors[4] = '#010203'
    const result = parseSettings({ monthColors: colors })
    expect(result.monthColors[3]).toBe(defaultSettings.monthColors[3])
    expect(result.monthColors[4]).toBe('#010203')
  })
})

describe('значения по умолчанию', () => {
  it('семестр с 1 сентября 2026 по 31 января 2027', () => {
    expect(defaultSemesterDates).toEqual({ start: '2026-09-01', end: '2027-01-31' })
  })

  it('12 цветов месяцев', () => {
    expect(defaultSettings.monthColors).toHaveLength(12)
  })
})
