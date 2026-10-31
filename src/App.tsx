import { useEffect, useState } from 'react'
import { todayIso } from './app/today'
import { useAppData } from './app/useAppData'
import { ru } from './i18n/ru'
import type { View } from './ui/layout/TopBar'
import { Workspace } from './ui/layout/Workspace'

export function App() {
  const data = useAppData()
  const [today, setToday] = useState(todayIso)
  const [view, setView] = useState<View>('grid')
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Если страница простояла открытой до следующего дня, «сегодня» обновляется при возврате к ней
  useEffect(() => {
    const refresh = () => setToday(todayIso())
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])

  const { active } = data

  if (!data.ready || !active) {
    return (
      <main className="app">
        <p>{ru.loading}</p>
      </main>
    )
  }

  return (
    <main className="app">
      <Workspace
        key={active.id}
        data={data}
        active={active}
        today={today}
        view={view}
        onViewChange={setView}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={setSettingsOpen}
      />
    </main>
  )
}
