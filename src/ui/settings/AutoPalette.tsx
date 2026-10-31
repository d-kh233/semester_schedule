import { useMemo, useState } from 'react'
import {
  buildPaletteVariants,
  MAX_BASE_COLORS,
  MIN_BASE_COLORS,
  validateBaseColors,
  type PaletteVariant,
} from '../../core/autoPalette'
import { contrastText, weekdayColor } from '../../core/colors'
import { ru } from '../../i18n/ru'

interface Props {
  baseColors: string[]
  // Текущая палитра, чтобы после «Применить» её можно было вернуть
  current: PaletteVariant
  levelCount: number
  onBaseColorsChange: (colors: string[]) => void
  onApply: (variant: PaletteVariant) => void
}

function Swatch({ color, label }: { color: string; label?: string }) {
  return (
    <span className="auto-palette__swatch" style={{ background: color, color: contrastText(color) }}>
      {label}
    </span>
  )
}

function VariantPreview({ variant }: { variant: PaletteVariant }) {
  return (
    <div className="auto-palette__preview">
      <div className="auto-palette__row" aria-label={ru.palette.auto.previewWeek}>
        {ru.weekdaysShort.map((name, i) => (
          <Swatch key={name} color={weekdayColor(i, variant.weekGradient)} label={name} />
        ))}
      </div>
      <div className="auto-palette__row auto-palette__row--months" aria-label={ru.palette.auto.previewMonths}>
        {variant.monthColors.map((color, i) => (
          <Swatch key={i} color={color} label={ru.months[i]?.slice(0, 3)} />
        ))}
      </div>
      <div className="auto-palette__row" aria-label={ru.palette.auto.previewLevels}>
        {variant.levelColors.map((color, i) => (
          <Swatch key={i} color={color} label={String(i + 1)} />
        ))}
      </div>
    </div>
  )
}

export function AutoPalette({ baseColors, current, levelCount, onBaseColorsChange, onApply }: Props) {
  // Набор может быть временно неверным (повтор цвета); сохраняем в настройки только верный
  const [draft, setDraft] = useState(baseColors)
  const [previous, setPrevious] = useState<PaletteVariant | null>(null)

  const error = validateBaseColors(draft)
  const variants = useMemo(() => buildPaletteVariants(draft, levelCount), [draft, levelCount])

  function change(next: string[]) {
    setDraft(next)
    if (validateBaseColors(next) === null) onBaseColorsChange(next)
  }

  function apply(variant: PaletteVariant) {
    setPrevious(current)
    onApply(variant)
  }

  return (
    <div className="auto-palette" data-testid="auto-palette">
      <h4>{ru.palette.auto.title}</h4>
      <p className="auto-palette__hint">{ru.palette.auto.hint}</p>
      <div className="auto-palette__bases">
        {draft.map((color, i) => (
          <span key={i} className="auto-palette__base">
            <input
              type="color"
              value={color}
              aria-label={ru.palette.auto.baseColor(i + 1)}
              data-testid={`base-color-${i}`}
              onChange={(e) => change(draft.map((c, j) => (j === i ? e.target.value : c)))}
            />
            <button
              type="button"
              className="btn"
              aria-label={ru.palette.auto.remove(i + 1)}
              data-testid={`base-remove-${i}`}
              disabled={draft.length <= MIN_BASE_COLORS}
              onClick={() => change(draft.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          className="btn"
          data-testid="base-add"
          disabled={draft.length >= MAX_BASE_COLORS}
          onClick={() => change([...draft, nextColor(draft)])}
        >
          {ru.palette.auto.add}
        </button>
      </div>
      {error && (
        <p className="controls__error" role="alert">
          {ru.palette.auto.errors[error]}
        </p>
      )}
      {previous && (
        <p className="auto-palette__applied" role="status">
          {ru.palette.auto.applied}{' '}
          <button
            type="button"
            className="btn"
            data-testid="palette-restore"
            onClick={() => {
              onApply(previous)
              setPrevious(null)
            }}
          >
            {ru.palette.auto.restore}
          </button>
        </p>
      )}
      <div className="auto-palette__variants">
        {variants.map((variant, k) => (
          <div key={k} className="auto-palette__variant" data-testid={`variant-${k}`}>
            <strong>{ru.palette.auto.variant(k + 1)}</strong>
            <VariantPreview variant={variant} />
            <button
              type="button"
              className="btn btn--primary"
              data-testid={`variant-apply-${k}`}
              onClick={() => apply(variant)}
            >
              {ru.palette.auto.apply}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Новый базовый цвет: первый из небольшого набора, которого ещё нет среди выбранных
const SPARE_COLORS = ['#4a6fa5', '#a9bf63', '#b98fb5', '#d98f7a', '#6aa6a0', '#c9a227', '#8c6a4f']

function nextColor(existing: string[]): string {
  const taken = new Set(existing.map((c) => c.toLowerCase()))
  return SPARE_COLORS.find((c) => !taken.has(c)) ?? '#808080'
}
