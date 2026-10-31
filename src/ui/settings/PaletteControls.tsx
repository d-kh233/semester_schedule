import { defaultSettings, type Settings } from '../../core/settings'
import { ru } from '../../i18n/ru'

interface Props {
  settings: Settings
  onSettingsChange: (patch: Partial<Settings>) => void
}

export function PaletteControls({ settings, onSettingsChange }: Props) {
  function setMonthColor(index: number, color: string) {
    const next = settings.monthColors.map((c, i) => (i === index ? color : c))
    onSettingsChange({ monthColors: next })
  }

  return (
    <details className="palette">
      <summary>{ru.palette.title}</summary>
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
          onClick={() =>
            onSettingsChange({
              weekGradient: defaultSettings.weekGradient,
              monthColors: defaultSettings.monthColors,
            })
          }
        >
          {ru.palette.reset}
        </button>
      </div>
    </details>
  )
}
