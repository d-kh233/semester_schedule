import { useState } from 'react'
import type { BackupData, BackupMerge } from '../../core/backup'
import { ru } from '../../i18n/ru'

interface Props {
  // Сколько создастся и обновится, ничего не записывая
  preview: (incoming: BackupData) => BackupMerge
  // Записывает слияние
  restore: (incoming: BackupData) => BackupMerge
}

interface Pending {
  incoming: BackupData
  skipped: number
  merge: BackupMerge
}

function totals(merge: BackupMerge): { created: number; updated: number } {
  const counts = Object.values(merge.counts)
  return {
    created: counts.reduce((sum, c) => sum + c.created, 0),
    updated: counts.reduce((sum, c) => sum + c.updated, 0),
  }
}

export function ImportBackupControls({ preview, restore }: Props) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onPick = async (file: File) => {
    setMessage(null)
    setError(null)
    try {
      const { readBackupWorkbook } = await import('../../excel/importXlsx')
      const read = await readBackupWorkbook(await file.arrayBuffer(), new Date().toISOString())
      setPending({ incoming: read.data, skipped: read.skipped, merge: preview(read.data) })
    } catch (e) {
      setPending(null)
      setError(e instanceof Error && e.message === ru.excel.backupMissing ? e.message : ru.excel.backupReadError)
    }
  }

  const onLoad = () => {
    if (!pending) return
    const merge = restore(pending.incoming)
    const { created, updated } = totals(merge)
    setMessage(ru.excel.backupDone(created, updated))
    setPending(null)
  }

  const counts = pending ? totals(pending.merge) : null

  return (
    <div>
      <p>
        <strong>{ru.excel.backupTitle}</strong>
      </p>
      <p>{ru.excel.backupHint}</p>
      <input
        type="file"
        accept=".xlsx"
        aria-label={ru.excel.backupPick}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onPick(file)
          e.target.value = ''
        }}
      />
      {pending && counts && (
        <>
          <p>{ru.excel.backupPreview(counts.created, counts.updated, pending.skipped)}</p>
          {counts.created + counts.updated === 0 && <p>{ru.excel.backupNothing}</p>}
          <button
            type="button"
            className="btn"
            disabled={counts.created + counts.updated === 0}
            onClick={onLoad}
          >
            {ru.excel.backupLoad}
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
