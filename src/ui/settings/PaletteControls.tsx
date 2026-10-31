import type { PaletteVariant } from '../../core/autoPalette'
import type { ImportanceLevel } from '../../core/catalog'
import { DEFAULT_LEVEL_COLORS, sortLevels } from '../../core/catalog'
import { defaultSettings, type Settings } from '../../core/settings'
import { ru } from '../../i18n/ru'
import { AutoPalette } from './AutoPalette'

interface Props {
  settings: Settings
  levels: ImportanceLevel[]
  onSettingsChange: (patch: Partial<Settings>) => void
  onLevelColorsChange: (colors: readonly string[]) => void
}

export function PaletteControls({ settings, levels, onSettingsChange, onLevelColorsChange }: Props) {
  const levelColors = sortLevels(levels).map((l) => l.color)

  function setMonthColor(index: number, color: string) {
    const next = settings.monthColors.map((c, i) => (i === index ? color : c))
    onSettingsChange({ monthColors: next })
  }

  function applyVariant(variant: PaletteVariant) {
    onSettingsChange({ weekGradient: variant.weekGradient, monthColors: variant.monthColors })
    onLevelColorsChange(variant.levelColors)
  }

  return (
    <section className="palette">
      <h3>{ru.palette.title}</h3>
      <AutoPalette
        baseColors={settings.paletteBases}
        current={{
          weekGradient: settings.weekGradient,
          monthColors: settings.monthColors,
          levelColors,
        }}
        levelCount={levels.length}
        onBaseColorsChange={(paletteBases) => onSettingsChange({ paletteBases })}
        onApply={applyVariant}
      />
      <h4>{ru.palette.manualTitle}</h4>
      <div className="palette__body">
        <label>
          {ru.palette.weekLight}
          <input
            type="color"
            value={settings.weekGradient.light}
            onChange={(e) =>
              onSettingsChange({ weekGradient: { ...settings.weekGradient, light: e.target.value } })
            }
          />
        </label>
        <label>
          {ru.palette.weekDark}
          <input
            type="color"
            value={settings.weekGradient.dark}
            onChange={(e) =>
              onSettingsChange({ weekGradient: { ...settings.weekGradient, dark: e.target.value } })
            }
          />
        </label>
        {ru.months.map((name, index) => (
          <label key={name}>
            {name}
            <input
              type="color"
              value={settings.monthColors[index]}
              onChange={(e) => setMonthColor(index, e.target.value)}
            />
          </label>
        ))}
        <button
          type="button"
          className="btn"
          onClick={() => {
            onSettingsChange({
              weekGradient: defaultSettings.weekGradient,
              monthColors: defaultSettings.monthColors,
            })
            onLevelColorsChange(DEFAULT_LEVEL_COLORS)
          }}
        >
          {ru.palette.reset}
        </button>
      </div>
    </section>
  )
}
