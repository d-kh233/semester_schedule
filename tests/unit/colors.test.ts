import { describe, expect, it } from 'vitest'
import { isHexColor, mixHex, weekdayColor, weekdayWeight } from '../../src/core/colors'

describe('isHexColor', () => {
  it('проверяет формат #rrggbb', () => {
    expect(isHexColor('#a1B2c3')).toBe(true)
    expect(isHexColor('#abc')).toBe(false)
    expect(isHexColor('red')).toBe(false)
    expect(isHexColor('a1b2c3')).toBe(false)
  })
})

describe('mixHex', () => {
  it('крайние точки возвращают исходные цвета', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('середина между чёрным и белым', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('смешивает по каналам', () => {
    expect(mixHex('#ff0000', '#0000ff', 0.5)).toBe('#800080')
  })
})

describe('градиент дней недели (0 = понедельник)', () => {
  it('FR-2: воскресенье и понедельник самые тёмные', () => {
    expect(weekdayWeight(0)).toBe(1)
    expect(weekdayWeight(6)).toBe(1)
  })

  it('FR-2: среда самая светлая, остальные темнее', () => {
    expect(weekdayWeight(2)).toBe(0)
    for (const d of [0, 1, 3, 4, 5, 6]) {
      expect(weekdayWeight(d)).toBeGreaterThan(0)
    }
  })

  it('плавный переход: к среде светлеет, после среды темнеет', () => {
    expect(weekdayWeight(0)).toBeGreaterThan(weekdayWeight(1))
    expect(weekdayWeight(1)).toBeGreaterThan(weekdayWeight(2))
    expect(weekdayWeight(2)).toBeLessThan(weekdayWeight(3))
    expect(weekdayWeight(3)).toBeLessThan(weekdayWeight(4))
    expect(weekdayWeight(4)).toBeLessThan(weekdayWeight(5))
    expect(weekdayWeight(5)).toBeLessThan(weekdayWeight(6))
  })

  it('цвет среды — светлый, понедельника и воскресенья — тёмный', () => {
    const palette = { light: '#ffffff', dark: '#000000' }
    expect(weekdayColor(2, palette)).toBe('#ffffff')
    expect(weekdayColor(0, palette)).toBe('#000000')
    expect(weekdayColor(6, palette)).toBe('#000000')
  })

  it('цвета градиента настраиваются', () => {
    const palette = { light: '#ffffff', dark: '#ff0000' }
    expect(weekdayColor(0, palette)).toBe('#ff0000')
  })
})
