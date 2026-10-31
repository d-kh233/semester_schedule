import { describe, expect, it } from 'vitest'
import {
  buildPaletteVariants,
  MAX_BASE_COLORS,
  MIN_BASE_COLORS,
  seasonOfMonth,
  levelColorsFromBase,
  validateBaseColors,
  variantCount,
  weekdayColorsFromBases,
} from '../../src/core/autoPalette'
import { hexToHsl, hslToHex, isHexColor, weekdayColor } from '../../src/core/colors'

const BASES = ['#7d3040', '#e0a45e', '#9db4cf', '#a9bf63', '#b98fb5', '#d98f7a', '#4a6fa5']
const take = (n: number) => BASES.slice(0, n)

describe('hexToHsl и hslToHex', () => {
  it('туда и обратно возвращают тот же цвет (с точностью до 1 в канале)', () => {
    for (const hex of BASES) {
      const [h, s, l] = hexToHsl(hex)
      const back = hslToHex(h, s, l)
      expect(isHexColor(back)).toBe(true)
      for (const i of [1, 3, 5]) {
        const a = parseInt(hex.slice(i, i + 2), 16)
        const b = parseInt(back.slice(i, i + 2), 16)
        expect(Math.abs(a - b)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('серый цвет не имеет насыщенности', () => {
    expect(hexToHsl('#808080')[1]).toBe(0)
  })
})

describe('validateBaseColors', () => {
  it('принимает от 3 до 7 разных цветов', () => {
    for (let n = MIN_BASE_COLORS; n <= MAX_BASE_COLORS; n++) {
      expect(validateBaseColors(take(n))).toBeNull()
    }
  })

  it('меньше трёх — ошибка «мало»', () => {
    expect(validateBaseColors(take(2))).toBe('too-few')
  })

  it('больше семи — ошибка «много»', () => {
    expect(validateBaseColors([...BASES, '#112233'])).toBe('too-many')
  })

  it('одинаковые цвета считаются повтором, регистр не важен', () => {
    expect(validateBaseColors(['#7d3040', '#E0A45E', '#e0a45e'])).toBe('duplicate')
  })

  it('неверный формат цвета — ошибка', () => {
    expect(validateBaseColors(['#7d3040', '#e0a45e', 'red'])).toBe('invalid')
  })
})

describe('variantCount', () => {
  it('3 цвета дают 4 варианта, 4 — 5, дальше 6', () => {
    expect(variantCount(3)).toBe(4)
    expect(variantCount(4)).toBe(5)
    expect(variantCount(5)).toBe(6)
    expect(variantCount(7)).toBe(6)
  })
})

describe('seasonOfMonth', () => {
  it('зима декабрь–февраль, весна март–май, лето июнь–август, осень сентябрь–ноябрь', () => {
    const seasons = Array.from({ length: 12 }, (_, i) => seasonOfMonth(i).season)
    expect(seasons).toEqual([0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 0])
  })

  it('место месяца в сезоне: декабрь первый, февраль третий', () => {
    expect(seasonOfMonth(11).position).toBe(0)
    expect(seasonOfMonth(0).position).toBe(1)
    expect(seasonOfMonth(1).position).toBe(2)
    expect(seasonOfMonth(8).position).toBe(0)
  })
})

describe('buildPaletteVariants', () => {
  it('число вариантов от 4 до 6 и зависит от числа базовых цветов', () => {
    for (let n = MIN_BASE_COLORS; n <= MAX_BASE_COLORS; n++) {
      const variants = buildPaletteVariants(take(n), 3)
      expect(variants.length).toBe(variantCount(n))
      expect(variants.length).toBeGreaterThanOrEqual(4)
      expect(variants.length).toBeLessThanOrEqual(6)
    }
  })

  it('варианты отличаются друг от друга', () => {
    for (let n = MIN_BASE_COLORS; n <= MAX_BASE_COLORS; n++) {
      const variants = buildPaletteVariants(take(n), 3)
      const keys = new Set(variants.map((v) => JSON.stringify(v)))
      expect(keys.size).toBe(variants.length)
    }
  })

  it('в каждом варианте 12 разных цветов месяцев, все в формате #rrggbb', () => {
    for (const variant of buildPaletteVariants(take(3), 3)) {
      expect(variant.monthColors).toHaveLength(12)
      expect(new Set(variant.monthColors).size).toBe(12)
      for (const color of variant.monthColors) expect(isHexColor(color)).toBe(true)
    }
  })

  it('внутри сезона цвета идут с градацией: каждый следующий месяц темнее', () => {
    for (const variant of buildPaletteVariants(take(4), 3)) {
      // осень: сентябрь (8), октябрь (9), ноябрь (10)
      const lightness = [8, 9, 10].map((i) => hexToHsl(variant.monthColors[i] ?? '#000000')[2])
      expect(lightness[0]).toBeGreaterThan(lightness[1] ?? 0)
      expect(lightness[1]).toBeGreaterThan(lightness[2] ?? 0)
    }
  })

  it('сезоны различимы по светлоте: зима светлее весны, весна светлее лета, лето светлее осени', () => {
    const [variant] = buildPaletteVariants(take(3), 3)
    const mean = (indexes: number[]) =>
      indexes.reduce((sum, i) => sum + hexToHsl(variant?.monthColors[i] ?? '#000000')[2], 0) /
      indexes.length
    const winter = mean([11, 0, 1])
    const spring = mean([2, 3, 4])
    const summer = mean([5, 6, 7])
    const autumn = mean([8, 9, 10])
    expect(winter).toBeGreaterThan(spring)
    expect(spring).toBeGreaterThan(summer)
    expect(summer).toBeGreaterThan(autumn)
  })

  it('цвета уровней: по одному на уровень, первый самый насыщенный и тёмный, дальше светлее', () => {
    for (const levels of [1, 3, 5, 9]) {
      const [variant] = buildPaletteVariants(take(3), levels)
      expect(variant?.levelColors).toHaveLength(levels)
      const lightness = (variant?.levelColors ?? []).map((c) => hexToHsl(c)[2])
      for (let i = 1; i < lightness.length; i++) {
        expect(lightness[i]).toBeGreaterThan(lightness[i - 1] ?? 1)
      }
    }
  })

  it('цвета месяцев и уровней идут от оттенков базовых цветов', () => {
    const bases = take(3)
    const baseHues = bases.map((b) => hexToHsl(b)[0])
    const distance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
    for (const variant of buildPaletteVariants(bases, 3)) {
      for (const color of [...variant.monthColors, ...variant.levelColors]) {
        const hue = hexToHsl(color)[0]
        expect(Math.min(...baseHues.map((h) => distance(h, hue)))).toBeLessThan(8)
      }
    }
  })

  it('дни недели одинаковы во всех вариантах: порядок базовых цветов задаёт пользователь', () => {
    const variants = buildPaletteVariants(take(4), 3)
    for (const v of variants) expect(v.weekGradient).toEqual(variants[0]?.weekGradient)
  })

  it('цвета месяцев приглушённые: насыщенность не выше 0.45', () => {
    for (const variant of buildPaletteVariants(['#ff0000', '#00ff00', '#0000ff'], 3)) {
      for (const color of variant.monthColors) expect(hexToHsl(color)[1]).toBeLessThanOrEqual(0.46)
    }
  })

  it('цвета важности под палитру: levelColorsFromBase даёт цвет на каждый уровень, светлее к концу', () => {
    const colors = levelColorsFromBase('#e0a45e', 4)
    expect(colors).toHaveLength(4)
    const l = colors.map((c) => hexToHsl(c)[2])
    expect(l[3]).toBeGreaterThan(l[0] ?? 1)
  })

  it('результат не зависит от часов и случайности: два вызова дают одно и то же', () => {
    expect(buildPaletteVariants(take(4), 3)).toEqual(buildPaletteVariants(take(4), 3))
  })

  it('при неверных базовых цветах вариантов нет', () => {
    expect(buildPaletteVariants(take(2), 3)).toEqual([])
  })
})

describe('weekdayColorsFromBases', () => {
  const A = '#ff0000'
  const B = '#00ff00'
  const C = '#0000ff'

  it('3 цвета: пн — первый, ср — второй, вс — третий', () => {
    const days = weekdayColorsFromBases([A, B, C])
    expect(days).toHaveLength(7)
    expect(days[0]).toBe(A)
    expect(days[2]).toBe(B)
    expect(days[6]).toBe(C)
  })

  it('между опорными днями плавный переход (смесь соседних цветов)', () => {
    const days = weekdayColorsFromBases([A, B, C])
    expect(days[1]).toBe('#808000') // вт: середина между красным и зелёным
    expect(days[3]).toBe('#00bf40') // чт: четверть пути от зелёного к синему
    expect(days[5]).toBe('#0040bf') // сб: три четверти
  })

  it('4 цвета: пн, ср, пт, вс', () => {
    const d = ['#111111', '#333333', '#555555', '#777777']
    const days = weekdayColorsFromBases(d)
    expect([days[0], days[2], days[4], days[6]]).toEqual(d)
  })

  it('5 цветов: пн, вт, ср, пт, вс', () => {
    const d = ['#111111', '#222222', '#333333', '#555555', '#777777']
    const days = weekdayColorsFromBases(d)
    expect([days[0], days[1], days[2], days[4], days[6]]).toEqual(d)
  })

  it('6 цветов: пн, вт, ср, чт, пт, вс', () => {
    const d = ['#111111', '#222222', '#333333', '#444444', '#555555', '#777777']
    const days = weekdayColorsFromBases(d)
    expect([days[0], days[1], days[2], days[3], days[4], days[6]]).toEqual(d)
  })

  it('7 цветов: у каждого дня свой цвет по порядку', () => {
    const d = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666', '#777777']
    expect(weekdayColorsFromBases(d)).toEqual(d)
  })

  it('все цвета в формате #rrggbb; неверный набор даёт пустой список', () => {
    for (const c of weekdayColorsFromBases(take(5))) expect(isHexColor(c)).toBe(true)
    expect(weekdayColorsFromBases(take(2))).toEqual([])
  })

  it('weekdayColor в сетке берёт цвета дней из варианта', () => {
    const [variant] = buildPaletteVariants([A, B, C], 3)
    expect(weekdayColor(0, variant?.weekGradient ?? { light: '#fff', dark: '#000' })).toBe(A)
    expect(weekdayColor(2, variant?.weekGradient ?? { light: '#fff', dark: '#000' })).toBe(B)
  })
})
