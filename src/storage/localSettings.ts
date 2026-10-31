// Настройки шага 2 лежали в localStorage. Читаем их один раз при переезде в IndexedDB.
// Старую запись не удаляем: данные не должны пропасть.

const KEY = 'semester-schedule:settings'

export function readLegacySettingsJson(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
