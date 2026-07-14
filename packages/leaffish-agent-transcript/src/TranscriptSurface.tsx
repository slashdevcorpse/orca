import { useMemo, type ReactElement } from 'react'
import type { TranscriptHostActions, TranscriptSurfaceProps } from './component-contract'
import { assertTranscriptDocumentV1 } from './contract'
import { useTranscriptPreferences } from './preferences'
import { TranscriptTurn } from './TranscriptTurn'

export function TranscriptSurface({
  document,
  preferenceNamespace,
  preferenceStorage,
  className,
  emptyState,
  renderMarkdown,
  renderImage,
  renderContent,
  onOpenFile,
  onOpenDiff
}: TranscriptSurfaceProps): ReactElement {
  assertTranscriptDocumentV1(document)
  const { preferences, updatePreferences } = useTranscriptPreferences(
    preferenceNamespace,
    preferenceStorage
  )
  const hostActions = useMemo<TranscriptHostActions>(
    () => ({ renderMarkdown, renderImage, renderContent, onOpenFile, onOpenDiff }),
    [renderMarkdown, renderImage, renderContent, onOpenFile, onOpenDiff]
  )
  const classes = ['leaffish-transcript', className].filter(Boolean).join(' ')

  return (
    <section className={classes} aria-label="Agent transcript" data-status={document.status}>
      {document.turns.length > 0 ? (
        <div className="leaffish-transcript__toolbar" aria-label="Transcript display controls">
          <button
            type="button"
            aria-pressed={!preferences.collapseCompletedActivity}
            onClick={() =>
              updatePreferences({
                collapseCompletedActivity: !preferences.collapseCompletedActivity
              })
            }
          >
            {preferences.collapseCompletedActivity ? 'Expand activity' : 'Collapse activity'}
          </button>
          <button
            type="button"
            aria-pressed={preferences.expandChangedFiles}
            onClick={() =>
              updatePreferences({ expandChangedFiles: !preferences.expandChangedFiles })
            }
          >
            {preferences.expandChangedFiles ? 'Collapse file changes' : 'Expand file changes'}
          </button>
        </div>
      ) : null}
      <div className="leaffish-transcript__turns" role="log" aria-live="off">
        {document.turns.length === 0
          ? (emptyState ?? <p className="leaffish-transcript__empty">No conversation yet.</p>)
          : document.turns.map((turn) => (
              <TranscriptTurn
                key={turn.id}
                turn={turn}
                preferences={preferences}
                updatePreferences={updatePreferences}
                hostActions={hostActions}
              />
            ))}
      </div>
    </section>
  )
}
