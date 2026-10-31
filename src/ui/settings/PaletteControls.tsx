import { useState } from 'react'
import type { PaletteVariant } from '../../core/autoPalette'
import { DEFAULT_LEVEL_COLORS } from '../../core/catalog'
import { resolveTodayColor, weekdayColor } from '../../core/colors'
import type { SchedulePalette } from '../../core/schedulePalette'
import { defaultSettings, type Settings } from '../../core/settings'
import { ru } from '../../i18n/ru'
import { AutoPalette } from './AutoPalette'
import { SavedPalettes } from './SavedPalettes'

interface Props {
  scheduleName: string
  // Палитра открытого расписания (своя или общая)
  palette: SchedulePalette
  settings: Settings
  levelCount: number
  onPaletteChange: (palette: SchedulePalette) => void
  onSettingsChange: (patch: Partial<Settings>) => void
}

export function PaletteControls({
  scheduleName,
  palette,
  settings,
  levelCount,
  onPaletteChange,
  onSettingsChange,
}: Props) {
  // Палитра, бывшая до последнего «Применить»: её можно вернуть, пока открыто окно
  const [previous, setPrevious] = useState<SchedulePalette | null>(null)

  function setMonthColor(index: number, color: string) {
    onPaletteChange({
      ...palette,
      monthColors: palette.monthColors.map((c, i) => (i === index ? color : c)),
    })
  }

  // Свой цвет дня: остальные дни остаются как были
  function setDayColor(day: number, color: string) {
    const days = ru.weekdaysShort.map((_, d) =>
      d === day ? color : weekdayColor(d, palette.weekGradient),
    )
    onPaletteChange({ ...palette, weekGradient: { ...palette.weekGradient, days } })
  }

  function applyPalette(next: PaletteVariant) {
    setPrevious(palette)
    onPaletteChange(next)
  }

  function reset() {
    onPaletteChange({
      weekGradient: defaultSettings.weekGradient,
      monthColors: defaultSettings.monthColors,
      levelColors: palette.levelColors.map((c, i) => DEFAULT_LEVEL_COLORS[i] ?? c),
    })
    onSettingsChange({ todayColor: null })
  }

  return (
    <section className="palette">
      <h3>{ru.palette.title}</h3>
      <p className="auto-palette__hint" data-testid="palette-scope">
        {ru.palette.scope(scheduleName)}
      </p>
      {previous && (
        <p className="auto-palette__applied" role="status">
          {ru.palette.auto.applied}{' '}
          <button
            type="button"
            className="btn"
            data-testid="palette-restore"
            onClick={() => {
              onPaletteChange(previous)
              setPrevious(null)
            }}
          >
            {ru.palette.auto.restore}
          </button>
        </p>
      )}
      <AutoPalette
        baseColors={settings.paletteBases}
        levelCount={levelCount}
        onBaseColorsChange={(paletteBases) => onSettingsChange({ paletteBases })}
        onApply={applyPalette}
      />
      <SavedPalettes
        saved={settings.savedPalettes}
        current={palette}
        onSave={(name, saved) =>
          onSettingsChange({
            savedPalettes: [
              ...settings.savedPalettes,
              { id: crypto.randomUUID(), name, palette: saved },
            ],
          })
        }
        onApply={applyPalette}
        onDelete={(id) =>
          onSettingsChange({ savedPalettes: settings.savedPalettes.filter((p) => p.id !== id) })
        }
      />
      <h4>{ru.palette.manualTitle}</h4>
      <div className="palette__body">
        <label>
          {ru.palette.weekLight}
          <input
            type="color"
            value={palette.weekGradient.light}
            onChange={(e) =>
              onPaletteChange({
                ...palette,
                weekGradient: { light: e.target.value, dark: palette.weekGradient.dark },
              })
            }
          />
        </label>
        <label>
          {ru.palette.weekDark}
          <input
            type="color"
            value={palette.weekGradient.dark}
            onChange={(e) =>
              onPaletteChange({
                ...palette,
                weekGradient: { light: palette.weekGradient.light, dark: e.target.value },
              })
            }
          />
        </label>
        {ru.weekdaysShort.map((name, day) => (
          <label key={name}>
            {name}
            <input
              type="color"
              data-testid={`week-color-${day}`}
              value={weekdayColor(day, palette.weekGradient)}
              onChange={(e) => setDayColor(day, e.target.value)}
            />
          </label>
        ))}
        {ru.months.map((name, index) => (
          <label key={name}>
            {name}
            <input
              type="color"
              value={palette.monthColors[index]}
              onChange={(e) => setMonthColor(index, e.target.value)}
            />
          </label>
        ))}
        <label>
          {ru.palette.today}
          <input
            type="color"
            data-testid="today-color"
            value={resolveTodayColor(settings.todayColor, palette.weekGradient)}
            onChange={(e) => onSettingsChange({ todayColor: e.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="today-auto"
            checked={settings.todayColor === null}
            onChange={(e) =>
              onSettingsChange({
                todayColor: e.target.checked
                  ? null
                  : resolveTodayColor(null, palette.weekGradient),
              })
            }
          />
          {ru.palette.todayAuto}
        </label>
        <button type="button" className="btn" onClick={reset}>
          {ru.palette.reset}
        </button>
      </div>
    </section>
  )
}
