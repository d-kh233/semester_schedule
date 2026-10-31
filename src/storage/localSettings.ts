// Временное хранение настроек в браузере. На шаге 3 заменится на IndexedDB, на шаге 10 на облако.

import { defaultSettings, parseStoredSettings, type Settings } from '../core/settings'

const KEY = 'semester-schedule:settings'

export function loadSettings(): Settings {
  try {
    return parseStoredSettings(localStorage.getItem(KEY))
  } catch {
    return defaultSettings
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Хранилище недоступно (приватный режим, переполнение): работаем без сохранения
  }
}
