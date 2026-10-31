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

describe('базовые цвета палитры (paletteBases)', () => {
  it('старая запись без поля читается: берутся базовые цвета по умолчанию', () => {
    const old = { weekGradient: defaultSettings.weekGradient, monthColors: defaultSettings.monthColors }
    expect(parseSettings(old).paletteBases).toEqual(defaultSettings.paletteBases)
  })

  it('верный набор из 3–7 цветов сохраняется', () => {
    const bases = ['#112233', '#445566', '#778899', '#aabbcc']
    expect(parseSettings({ paletteBases: bases }).paletteBases).toEqual(bases)
  })

  it('испорченный набор (мало цветов, не цвет, повтор) заменяется значениями по умолчанию', () => {
    expect(parseSettings({ paletteBases: ['#112233'] }).paletteBases).toEqual(
      defaultSettings.paletteBases,
    )
    expect(parseSettings({ paletteBases: ['#112233', 'x', '#778899'] }).paletteBases).toEqual(
      defaultSettings.paletteBases,
    )
    expect(parseSettings({ paletteBases: '#112233' }).paletteBases).toEqual(
      defaultSettings.paletteBases,
    )
  })

  it('по умолчанию базовых цветов от 3 до 7', () => {
    expect(defaultSettings.paletteBases.length).toBeGreaterThanOrEqual(3)
    expect(defaultSettings.paletteBases.length).toBeLessThanOrEqual(7)
  })
})

describe('цвета дней недели (weekGradient.days)', () => {
  const days = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777']
  const base = { light: '#ffffff', dark: '#000000' }

  it('верные 7 цветов сохраняются', () => {
    expect(parseSettings({ weekGradient: { ...base, days } }).weekGradient.days).toEqual(days)
  })

  it('старая запись без days читается без этого поля', () => {
    expect(parseSettings({ weekGradient: base }).weekGradient.days).toBeUndefined()
  })

  it('испорченный список (не 7 или не цвет) отбрасывается, light и dark остаются', () => {
    const bad = parseSettings({ weekGradient: { ...base, days: days.slice(0, 6) } }).weekGradient
    expect(bad.days).toBeUndefined()
    expect(bad.dark).toBe('#000000')
    expect(parseSettings({ weekGradient: { ...base, days: [...days.slice(0, 6), 'x'] } }).weekGradient.days).toBeUndefined()
  })
})
