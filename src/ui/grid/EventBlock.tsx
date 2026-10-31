import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react'
import { contrastText } from '../../core/colors'
import type { GridBlock } from '../../core/gridBlocks'
import { ru } from '../../i18n/ru'

interface Props {
  block: GridBlock
  monthKey: string
  // Первая строка сетки, которую занимает месяц (строка 0 месяца)
  firstRow: number
  mutePast: boolean
  onOpen: (eventId: string) => void
}

function classesOf(block: GridBlock, mutePast: boolean): string {
  const classes = ['block']
  if (block.color === null) classes.push('block--plain')
  if (block.background) classes.push('block--background')
  if (mutePast && block.past) classes.push('block--past')
  if (block.done) classes.push('block--done')
  if (block.planned) classes.push('block--planned')
  if (block.crowded) classes.push('block--crowded')
  if (block.continuesLeft) classes.push('block--cont-left')
  if (block.continuesRight) classes.push('block--cont-right')
  return classes.join(' ')
}

function tooltip(block: GridBlock): string {
  const marks: string[] = []
  if (block.planned) marks.push(ru.grid.blockPlanned)
  if (block.crowded) marks.push(ru.grid.blockCrowded)
  if (block.done) marks.push(ru.grid.blockDone)
  return marks.length > 0 ? `${block.fullTitle} (${marks.join(', ')})` : block.fullTitle
}

export function EventBlock({ block, monthKey, firstRow, mutePast, onOpen }: Props) {
  const style: CSSProperties = {
    gridRow: firstRow + block.row,
    gridColumn: `${block.startDay + 1} / ${block.endDay + 2}`,
    ...(block.color !== null ? { background: block.color, color: contrastText(block.color) } : {}),
  }
  // На телефоне открывается одним касанием, мышью — двойным щелчком
  const onClick = (event: MouseEvent) => {
    const pointer = event.nativeEvent as { pointerType?: string }
    if (pointer.pointerType === 'touch') onOpen(block.eventId)
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') onOpen(block.eventId)
  }
  return (
    <div
      className={classesOf(block, mutePast)}
      style={style}
      role="button"
      tabIndex={0}
      title={tooltip(block)}
      aria-label={tooltip(block)}
      data-testid={`block-${monthKey}-${block.key}`}
      data-event-id={block.eventId}
      onDoubleClick={() => onOpen(block.eventId)}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className="block__label">{block.label}</span>
    </div>
  )
}
