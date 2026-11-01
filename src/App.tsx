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

  // Ctrl+Z и Ctrl+Y (и Ctrl+Shift+Z) отменяют и возвращают события; в полях ввода работает обычная отмена
  const { undo, redo } = data
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

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
