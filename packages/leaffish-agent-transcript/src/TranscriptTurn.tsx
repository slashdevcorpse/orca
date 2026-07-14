import type { ReactElement } from 'react'
import type { TranscriptHostActions } from './component-contract'
import type { TranscriptTurnV1 } from './contract'
import type { TranscriptPreferencesV1 } from './preferences'
import { TranscriptActivity } from './TranscriptActivity'
import { TranscriptChangedFiles } from './TranscriptChangedFiles'
import { TranscriptContent } from './TranscriptContent'

export function TranscriptTurn({
  turn,
  preferences,
  updatePreferences,
  hostActions
}: {
  turn: TranscriptTurnV1
  preferences: TranscriptPreferencesV1
  updatePreferences: (patch: Partial<Omit<TranscriptPreferencesV1, 'schemaVersion'>>) => void
  hostActions: TranscriptHostActions
}): ReactElement {
  return (
    <article className="leaffish-turn" data-status={turn.status}>
      {turn.request ? (
        <div className="leaffish-turn__request-group">
          <div className="leaffish-turn__request">
            <TranscriptContent
              content={turn.request}
              context={{ turnId: turn.id, role: 'user' }}
              {...hostActions}
            />
          </div>
          {turn.requestDelivery === 'failed' ? (
            <p className="leaffish-turn__delivery-failure">Not delivered — check the terminal</p>
          ) : null}
        </div>
      ) : null}
      <div className="leaffish-turn__response">
        <TranscriptActivity turn={turn} preferences={preferences} hostActions={hostActions} />
        {turn.finalResponse ? (
          <div className="leaffish-turn__final-response">
            <TranscriptContent
              content={turn.finalResponse}
              context={{ turnId: turn.id, role: 'assistant' }}
              {...hostActions}
            />
          </div>
        ) : null}
        {turn.changedFiles?.length ? (
          <TranscriptChangedFiles
            files={turn.changedFiles}
            defaultExpanded={preferences.expandChangedFiles}
            defaultDiffsExpanded={preferences.expandFileDiffs}
            onExpandedPreferenceChange={(expandChangedFiles) =>
              updatePreferences({ expandChangedFiles })
            }
            onDiffsPreferenceChange={(expandFileDiffs) => updatePreferences({ expandFileDiffs })}
            hostActions={hostActions}
          />
        ) : null}
        {turn.status === 'failed' && !turn.finalResponse ? (
          <p className="leaffish-turn__failure">The agent turn failed before a final response.</p>
        ) : null}
      </div>
    </article>
  )
}
