import { useState } from 'react'
import { levelColorsFromBase, type PaletteVariant } from '../../core/autoPalette'
import { DEFAULT_LEVEL_COLORS, sortLevels, type ImportanceLevel } from '../../core/catalog'
import { resolveTodayColor, weekdayColor, withAlpha } from '../../core/colors'
import {
  clampPastOpacity,
  DEFAULT_PAST_TEXT_OPACITY,
  MAX_PAST_TEXT_OPACITY,
  MIN_PAST_TEXT_OPACITY,
  withVariant,
  type SchedulePalette,
} from '../../core/schedulePalette'
import { defaultSettings, type Settings } from '../../core/settings'
import { ru } from '../../i18n/ru'
import { AutoPalette } from './AutoPalette'
import { SavedPalettes } from './SavedPalettes'

interface Props {
  scheduleName: string
  // Палитра открытого расписания (своя или общая)
  palette: SchedulePalette
  settings: Settings
  levels: ImportanceLevel[]
  onPaletteChange: (palette: SchedulePalette) => void
  onSettingsChange: (patch: Partial<Settings>) => void
}

export function PaletteControls({
  scheduleName,
  palette,
  settings,
  levels,
  onPaletteChange,
  onSettingsChange,
}: Props) {
  // Палитра, бывшая до последнего «Применить»: её можно вернуть, пока открыто окно
  const sortedLevels = sortLevels(levels)
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

  function setLevelColor(index: number, color: string) {
    onPaletteChange({
      ...palette,
      levelColors: palette.levelColors.map((c, i) => (i === index ? color : c)),
    })
  }

  // Цвета важности подбираются от второго цвета недели (среда), как при автосборке
  function matchLevels() {
    onPaletteChange({
      ...palette,
      levelColors: levelColorsFromBase(weekdayColor(2, palette.weekGradient), sortedLevels.length),
    })
  }

  // Автосборка подстраивает «сегодня» под новую палитру; сохранённая палитра приходит целиком
  function applyAuto(variant: PaletteVariant) {
    setPrevious(palette)
    onPaletteChange(withVariant(palette, variant))
  }

  function applySaved(saved: SchedulePalette) {
    setPrevious(palette)
    onPaletteChange(saved)
  }

  function reset() {
    onPaletteChange({
      weekGradient: defaultSettings.weekGradient,
      monthColors: defaultSettings.monthColors,
      levelColors: palette.levelColors.map((c, i) => DEFAULT_LEVEL_COLORS[i] ?? c),
      todayColor: null,
      pastTextOpacity: DEFAULT_PAST_TEXT_OPACITY,
    })
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
        levelCount={levels.length}
        onBaseColorsChange={(paletteBases) => onSettingsChange({ paletteBases })}
        onApply={applyAuto}
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
        onApply={applySaved}
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
            value={resolveTodayColor(palette.todayColor, palette.weekGradient)}
            onChange={(e) => onPaletteChange({ ...palette, todayColor: e.target.value })}
          />
        </label>
        <label>
          <input
            type="checkbox"
            data-testid="today-auto"
            checked={palette.todayColor === null}
            onChange={(e) =>
              onPaletteChange({
                ...palette,
                todayColor: e.target.checked
                  ? null
                  : resolveTodayColor(null, palette.weekGradient),
              })
            }
          />
          {ru.palette.todayAuto}
        </label>
        {sortedLevels.map((level, i) => (
          <label key={level.id}>
            {level.name}
            <input
              type="color"
              data-testid={`level-color-${level.number}`}
              value={palette.levelColors[i] ?? level.color}
              onChange={(e) => setLevelColor(i, e.target.value)}
            />
          </label>
        ))}
        <button type="button" className="btn" data-testid="match-levels" onClick={matchLevels}>
          {ru.palette.matchLevels}
        </button>
        <button type="button" className="btn" onClick={reset}>
          {ru.palette.reset}
        </button>
      </div>
      <h4>{ru.palette.pastTitle}</h4>
      <p className="auto-palette__hint">{ru.palette.pastHint}</p>
      <div className="past-sample" data-testid="past-sample">
        <label>
          {ru.palette.pastOpacity}
          <input
            type="range"
            data-testid="past-opacity"
            min={MIN_PAST_TEXT_OPACITY * 100}
            max={MAX_PAST_TEXT_OPACITY * 100}
            step={5}
            value={Math.round(palette.pastTextOpacity * 100)}
            onChange={(e) =>
              onPaletteChange({ ...palette, pastTextOpacity: clampPastOpacity(Number(e.target.value) / 100) })
            }
          />
          <output data-testid="past-opacity-value">{Math.round(palette.pastTextOpacity * 100)}%</output>
        </label>
        <div
          className="past-sample__cells"
          style={{ '--past-text': withAlpha(palette.weekGradient.dark, palette.pastTextOpacity) } as React.CSSProperties}
        >
          <div className="past-sample__empty">{ru.palette.pastSampleEmpty}</div>
          <div className="block block--past past-sample__block" data-testid="past-sample-block">
            <span className="block__label">{ru.palette.pastSampleBlock}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
