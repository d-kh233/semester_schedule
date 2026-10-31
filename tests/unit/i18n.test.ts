import { describe, expect, it } from 'vitest'
import { ru } from '../../src/i18n/ru'

describe('тексты интерфейса', () => {
  it('название приложения на русском', () => {
    expect(ru.appTitle).toMatch(/[а-яё]/i)
  })
})
