import { useEffect, useState } from 'react'
import { todayIso } from './app/today'
import { validateSemester } from './core/calendar'
import type { Settings } from './core/settings'
import { ru } from './i18n/ru'
import { loadSettings, saveSettings } from './storage/localSettings'
import { SemesterGrid } from './ui/grid/SemesterGrid'
import { PaletteControls } from './ui/settings/PaletteControls'
import { SemesterControls } from './ui/settings/SemesterControls'

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [draft, setDraft] = useState({ start: settings.semesterStart, end: settings.semesterEnd })
  const [today, setToday] = useState(todayIso)

  const error = validateSemester(draft.start, draft.end)

  useEffect(() => saveSettings(settings), [settings])

  // Если страница простояла открытой до следующего дня, «сегодня» обновляется при возврате к ней
  useEffect(() => {
    const refresh = () => setToday(todayIso())
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  function changeDates(start: string, end: string) {
    setDraft({ start, end })
    // Сетка меняется только на верном семестре; пока даты неверны, остаётся прежняя
    if (validateSemester(start, end) === null) {
      setSettings((s) => ({ ...s, semesterStart: start, semesterEnd: end }))
    }
  }

  function changeSettings(patch: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...patch }))
  }

  return (
    <main>
      <h1>{ru.appTitle}</h1>
      <SemesterControls
        settings={settings}
        draftStart={draft.start}
        draftEnd={draft.end}
        error={error}
        onDatesChange={changeDates}
        onSettingsChange={changeSettings}
      />
      <PaletteControls settings={settings} onSettingsChange={changeSettings} />
      <SemesterGrid settings={settings} today={today} />
    </main>
  )
}
