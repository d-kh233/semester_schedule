import { describe, expect, it } from 'vitest'
import {
  clampPastOpacity,
  DEFAULT_PAST_TEXT_OPACITY,
  withVariant,
  paintLevels,
  parseSavedPalettes,
  parseSchedulePalette,
  resolvePalette,
  validatePaletteName,
  type SavedPalette,
  type SchedulePalette,
} from '../../src/core/schedulePalette'
import { createSemester, parseSemester } from '../../src/core/model'
import { defaultSettings, parseSettings } from '../../src/core/settings'

const months = Array.from({ length: 12 }, (_, i) => `#10${(i + 16).toString(16)}0${(i + 16).toString(16)}`.slice(0, 7))
const palette: SchedulePalette = {
  weekGradient: { light: '#ffffff', dark: '#000000' },
  monthColors: months,
  levelColors: ['#111111', '#222222', '#333333'],
  todayColor: null,
  pastTextOpacity: 0.35,
}
const levels = [
  { id: 'b', number: 2, name: 'Два', color: '#bbbbbb', order: 2 },
  { id: 'a', number: 1, name: 'Один', color: '#aaaaaa', order: 1 },
  { id: 'c', number: 3, name: 'Три', color: '#cccccc', order: 3 },
  { id: 'd', number: 4, name: 'Четыре', color: '#dddddd', order: 4 },
]

describe('parseSchedulePalette', () => {
  it('верная палитра читается', () => {
    expect(parseSchedulePalette(palette)).toEqual(palette)
  })
  it('нет палитры или мусор: null (расписание использует общие цвета)', () => {
    expect(parseSchedulePalette(undefined)).toBeNull()
    expect(parseSchedulePalette('x')).toBeNull()
    expect(parseSchedulePalette({ ...palette, monthColors: months.slice(0, 11) })).toBeNull()
    expect(parseSchedulePalette({ ...palette, monthColors: [...months.slice(0, 11), 'red'] })).toBeNull()
    expect(parseSchedulePalette({ ...palette, weekGradient: { light: 'x', dark: '#000000' } })).toBeNull()
    expect(parseSchedulePalette({ ...palette, levelColors: ['#111111', 5] })).toBeNull()
  })
  it('цвета дней недели сохраняются, если их 7 и они верные', () => {
    const days = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777']
    const withDays = { ...palette, weekGradient: { ...palette.weekGradient, days } }
    expect(parseSchedulePalette(withDays)?.weekGradient.days).toEqual(days)
  })
})

describe('новые поля палитры: цвет «сегодня» и прозрачность текста прошедших блоков', () => {
  const old = { weekGradient: palette.weekGradient, monthColors: months, levelColors: ['#111111'] }

  it('палитра без этих полей (сохранена раньше) читается со значениями по умолчанию', () => {
    const parsed = parseSchedulePalette(old)
    expect(parsed?.todayColor).toBeNull()
    expect(parsed?.pastTextOpacity).toBe(DEFAULT_PAST_TEXT_OPACITY)
  })
  it('верные значения сохраняются', () => {
    const parsed = parseSchedulePalette({ ...old, todayColor: '#ff0000', pastTextOpacity: 0.6 })
    expect(parsed?.todayColor).toBe('#ff0000')
    expect(parsed?.pastTextOpacity).toBe(0.6)
  })
  it('неверный цвет «сегодня» даёт null, неверная прозрачность — значение по умолчанию', () => {
    const parsed = parseSchedulePalette({ ...old, todayColor: 'red', pastTextOpacity: 'x' })
    expect(parsed?.todayColor).toBeNull()
    expect(parsed?.pastTextOpacity).toBe(DEFAULT_PAST_TEXT_OPACITY)
  })
  it('прозрачность ограничивается: от 0.1 до 1', () => {
    expect(clampPastOpacity(0)).toBe(0.1)
    expect(clampPastOpacity(5)).toBe(1)
    expect(clampPastOpacity(0.5)).toBe(0.5)
    expect(clampPastOpacity(Number.NaN)).toBe(DEFAULT_PAST_TEXT_OPACITY)
  })
  it('выбранный вариант автосборки: цвет «сегодня» подбирается по палитре, прозрачность остаётся своя', () => {
    const current = { ...palette, todayColor: '#ff0000', pastTextOpacity: 0.7 }
    const next = withVariant(current, {
      weekGradient: { light: '#eeeeee', dark: '#222222' },
      monthColors: months,
      levelColors: ['#aaaaaa'],
    })
    expect(next.todayColor).toBeNull()
    expect(next.pastTextOpacity).toBe(0.7)
    expect(next.levelColors).toEqual(['#aaaaaa'])
  })
})

describe('resolvePalette', () => {
  it('у расписания своя палитра: берётся она', () => {
    expect(resolvePalette(palette, defaultSettings, levels)).toEqual(palette)
  })
  it('своей палитры нет: общие цвета настроек и цвета уровней', () => {
    const result = resolvePalette(null, defaultSettings, levels)
    expect(result.weekGradient).toEqual(defaultSettings.weekGradient)
    expect(result.monthColors).toEqual(defaultSettings.monthColors)
    expect(result.levelColors).toEqual(['#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd'])
    expect(result.todayColor).toBe(defaultSettings.todayColor)
    expect(result.pastTextOpacity).toBe(DEFAULT_PAST_TEXT_OPACITY)
  })
})

describe('paintLevels', () => {
  it('красит уровни по порядку номеров; без цвета в палитре уровень остаётся прежним', () => {
    const painted = paintLevels(levels, palette.levelColors)
    expect(painted.map((l) => [l.id, l.color])).toEqual([
      ['b', '#222222'],
      ['a', '#111111'],
      ['c', '#333333'],
      ['d', '#dddddd'],
    ])
  })
  it('исходные уровни не меняются', () => {
    paintLevels(levels, palette.levelColors)
    expect(levels[1]?.color).toBe('#aaaaaa')
  })
})

describe('расписание хранит свою палитру', () => {
  it('новое расписание без палитры', () => {
    expect(createSemester({ id: 'x', name: 'A', startDate: '2026-09-01', endDate: '2027-01-31' }, 'now').palette).toBeNull()
  })
  it('старая запись без поля palette читается, палитра null', () => {
    const old = { id: 'x', startDate: '2026-09-01', endDate: '2027-01-31', name: 'A' }
    expect(parseSemester(old, 'now')?.palette).toBeNull()
  })
  it('палитра в записи расписания читается', () => {
    const raw = { id: 'x', startDate: '2026-09-01', endDate: '2027-01-31', name: 'A', palette }
    expect(parseSemester(raw, 'now')?.palette).toEqual(palette)
  })
  it('испорченная палитра даёт null, остальные поля читаются', () => {
    const raw = { id: 'x', startDate: '2026-09-01', endDate: '2027-01-31', name: 'A', palette: { monthColors: 1 } }
    const s = parseSemester(raw, 'now')
    expect(s?.palette).toBeNull()
    expect(s?.name).toBe('A')
  })
})

describe('validatePaletteName', () => {
  const saved: SavedPalette[] = [{ id: '1', name: 'Осень', palette }]
  it('пустое имя и слишком длинное', () => {
    expect(validatePaletteName('  ', saved)).toBe('empty')
    expect(validatePaletteName('я'.repeat(41), saved)).toBe('too-long')
  })
  it('повтор имени (без учёта регистра и пробелов по краям)', () => {
    expect(validatePaletteName(' осень ', saved)).toBe('duplicate')
  })
  it('верное имя', () => {
    expect(validatePaletteName('Весна', saved)).toBeNull()
  })
})

describe('сохранённые палитры в настройках', () => {
  const entry = { id: 'p1', name: 'Осень', palette }
  it('читаются; испорченные записи пропускаются, верные остаются', () => {
    const result = parseSavedPalettes([entry, { id: 'p2', name: 'Плохая', palette: { monthColors: [] } }, 5, { name: 'без id', palette }])
    expect(result).toEqual([entry])
  })
  it('нет поля или не список: пустой список', () => {
    expect(parseSavedPalettes(undefined)).toEqual([])
    expect(parseSavedPalettes('x')).toEqual([])
    expect(parseSettings({}).savedPalettes).toEqual([])
    expect(defaultSettings.savedPalettes).toEqual([])
  })
  it('сохраняются вместе с настройками', () => {
    expect(parseSettings({ savedPalettes: [entry] }).savedPalettes).toEqual([entry])
  })
})
