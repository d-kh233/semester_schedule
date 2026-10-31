import { useState } from 'react'
import type { EventType, ImportanceLevel } from '../../core/catalog'
import {
  isBuiltInLevel,
  isBuiltInType,
  parseKeywords,
  validateKeywords,
  validateLevelName,
  validateTypeName,
  type DeleteBlock,
} from '../../core/catalogRules'
import type { TypeFields } from '../../app/useAppData'
import { ru } from '../../i18n/ru'

const MAX_LEVEL_NUMBER = 9

interface Props {
  types: EventType[]
  levels: ImportanceLevel[]
  onAddType: (fields: TypeFields) => void
  onUpdateType: (id: string, patch: Partial<TypeFields>) => void
  onDeleteType: (id: string) => DeleteBlock
  onRenameLevel: (id: string, name: string) => void
  onDeleteLevel: (id: string) => DeleteBlock
  onAddLevel: (upTo: number) => number
}

const t = ru.catalog

// Причина, почему удалить нельзя (или пусто, если удаление прошло)
function blockText(block: DeleteBlock): string | null {
  if (block.ok) return null
  return block.reason === 'built-in' ? t.builtIn : t.inUse
}

function keywordsError(error: 'empty' | 'spaces' | 'duplicate'): string {
  return error === 'empty' ? t.errors.keywordsEmpty : t.errors[error]
}

function DefaultImportanceSelect({
  value,
  levels,
  onChange,
}: {
  value: number | null
  levels: ImportanceLevel[]
  onChange: (value: number | null) => void
}) {
  return (
    <select
      aria-label={t.defaultImportance}
      value={value === null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    >
      <option value="">{t.noImportance}</option>
      {levels.map((level) => (
        <option key={level.id} value={level.number}>
          {level.name}
        </option>
      ))}
    </select>
  )
}

function TypeRow({
  type,
  types,
  levels,
  onUpdate,
  onDelete,
}: {
  type: EventType
  types: EventType[]
  levels: ImportanceLevel[]
  onUpdate: Props['onUpdateType']
  onDelete: Props['onDeleteType']
}) {
  const [name, setName] = useState(type.name)
  const [keywords, setKeywords] = useState(type.keywords.join(', '))
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [blocked, setBlocked] = useState<string | null>(null)
  const builtIn = isBuiltInType(type)

  function saveName() {
    const problem = validateTypeName(name, types, type.id)
    if (problem) return setError(t.errors[problem])
    setError(null)
    if (name.trim() !== type.name) onUpdate(type.id, { name: name.trim() })
  }

  function saveKeywords() {
    const words = parseKeywords(keywords)
    const problem = validateKeywords(words, types, type.id)
    if (problem) return setError(keywordsError(problem))
    setError(null)
    onUpdate(type.id, { keywords: words })
  }

  function remove() {
    const block = onDelete(type.id)
    setConfirming(false)
    setBlocked(blockText(block))
  }

  return (
    <li className="catalog__row" data-testid={`type-row-${type.id}`}>
      <label>
        {t.typeName}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && saveName()}
        />
      </label>
      <label>
        {t.keywords}
        <input
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          onBlur={saveKeywords}
          onKeyDown={(e) => e.key === 'Enter' && saveKeywords()}
        />
      </label>
      <label>
        {t.defaultImportance}
        <DefaultImportanceSelect
          value={type.defaultImportance}
          levels={levels}
          onChange={(defaultImportance) => onUpdate(type.id, { defaultImportance })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={type.showAtBottom}
          onChange={(e) => onUpdate(type.id, { showAtBottom: e.target.checked })}
        />
        {t.showAtBottom}
      </label>
      {builtIn && <span className="catalog__note">{t.standard}</span>}
      {!builtIn && !confirming && (
        <button type="button" className="btn btn--danger" onClick={() => setConfirming(true)}>
          {t.delete}
        </button>
      )}
      {!builtIn && confirming && (
        <span className="catalog__confirm">
          <button type="button" className="btn btn--danger" onClick={remove}>
            {t.deleteConfirm}
          </button>
          <button type="button" className="btn" onClick={() => setConfirming(false)}>
            {t.deleteCancel}
          </button>
        </span>
      )}
      {error && <p role="alert" className="catalog__error">{error}</p>}
      {blocked && <p role="alert" className="catalog__error">{blocked}</p>}
    </li>
  )
}

function AddTypeForm({ types, levels, onAdd }: { types: EventType[]; levels: ImportanceLevel[]; onAdd: Props['onAddType'] }) {
  const [name, setName] = useState('')
  const [keywords, setKeywords] = useState('')
  const [defaultImportance, setDefaultImportance] = useState<number | null>(null)
  const [showAtBottom, setShowAtBottom] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function add() {
    const words = parseKeywords(keywords)
    const nameProblem = validateTypeName(name, types)
    if (nameProblem) return setError(t.errors[nameProblem])
    const wordsProblem = validateKeywords(words, types)
    if (wordsProblem) return setError(keywordsError(wordsProblem))
    setError(null)
    onAdd({ name: name.trim(), keywords: words, defaultImportance, showAtBottom })
    setName('')
    setKeywords('')
    setDefaultImportance(null)
    setShowAtBottom(false)
  }

  return (
    <div className="catalog__add">
      <label>
        {t.typeName}
        <input placeholder={t.newTypeName} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        {t.keywords}
        <input placeholder={t.newTypeKeywords} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
      </label>
      <label>
        {t.defaultImportance}
        <DefaultImportanceSelect value={defaultImportance} levels={levels} onChange={setDefaultImportance} />
      </label>
      <label>
        <input type="checkbox" checked={showAtBottom} onChange={(e) => setShowAtBottom(e.target.checked)} />
        {t.showAtBottom}
      </label>
      <button type="button" className="btn btn--primary" onClick={add}>
        {t.addType}
      </button>
      {error && <p role="alert" className="catalog__error">{error}</p>}
    </div>
  )
}

function LevelRow({
  level,
  onRename,
  onDelete,
}: {
  level: ImportanceLevel
  onRename: Props['onRenameLevel']
  onDelete: Props['onDeleteLevel']
}) {
  const [name, setName] = useState(level.name)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [blocked, setBlocked] = useState<string | null>(null)
  const builtIn = isBuiltInLevel(level)

  function save() {
    const problem = validateLevelName(name)
    if (problem) return setError(t.errors[problem])
    setError(null)
    if (name.trim() !== level.name) onRename(level.id, name)
  }

  function remove() {
    const block = onDelete(level.id)
    setConfirming(false)
    setBlocked(blockText(block))
  }

  return (
    <li className="catalog__row" data-testid={`level-row-${level.number}`}>
      <span className="catalog__number">{level.number}</span>
      <label>
        {t.levelName}
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === 'Enter' && save()} />
      </label>
      {builtIn && <span className="catalog__note">{t.standard}</span>}
      {!builtIn && !confirming && (
        <button type="button" className="btn btn--danger" onClick={() => setConfirming(true)}>
          {t.delete}
        </button>
      )}
      {!builtIn && confirming && (
        <span className="catalog__confirm">
          <button type="button" className="btn btn--danger" onClick={remove}>
            {t.deleteConfirm}
          </button>
          <button type="button" className="btn" onClick={() => setConfirming(false)}>
            {t.deleteCancel}
          </button>
        </span>
      )}
      {error && <p role="alert" className="catalog__error">{error}</p>}
      {blocked && <p role="alert" className="catalog__error">{blocked}</p>}
    </li>
  )
}

export function CatalogControls({
  types,
  levels,
  onAddType,
  onUpdateType,
  onDeleteType,
  onRenameLevel,
  onDeleteLevel,
  onAddLevel,
}: Props) {
  const [levelError, setLevelError] = useState<string | null>(null)
  const highest = levels.reduce((max, l) => Math.max(max, l.number), 0)

  function addLevel() {
    if (highest + 1 > MAX_LEVEL_NUMBER) return setLevelError(t.levelsMax)
    setLevelError(null)
    onAddLevel(highest + 1)
  }

  return (
    <section className="catalog">
      <h4>{t.typesTitle}</h4>
      <ul className="catalog__list">
        {types.map((type) => (
          <TypeRow
            key={type.id}
            type={type}
            types={types}
            levels={levels}
            onUpdate={onUpdateType}
            onDelete={onDeleteType}
          />
        ))}
      </ul>
      <AddTypeForm types={types} levels={levels} onAdd={onAddType} />

      <h4>{t.levelsTitle}</h4>
      <ul className="catalog__list">
        {levels.map((level) => (
          <LevelRow
            key={level.id}
            level={level}
            onRename={onRenameLevel}
            onDelete={onDeleteLevel}
          />
        ))}
      </ul>
      <button type="button" className="btn btn--primary" onClick={addLevel}>
        {t.addLevel}
      </button>
      {levelError && <p role="alert" className="catalog__error">{levelError}</p>}
    </section>
  )
}
