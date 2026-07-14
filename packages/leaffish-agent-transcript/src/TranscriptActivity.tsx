import { useEffect, useId, useState, type ReactElement } from 'react'
import { ChevronRight } from 'lucide-react'
import type { TranscriptHostActions } from './component-contract'
import type { ReasoningActivityV1, TranscriptActivityV1, TranscriptTurnV1 } from './contract'
import { foldTurnActivity, summarizeTurnActivity } from './folding'
import type { TranscriptPreferencesV1 } from './preferences'
import { TranscriptContent } from './TranscriptContent'
import { TranscriptToolRow } from './TranscriptToolRow'

function ReasoningRow({
  activity,
  turnId,
  defaultCollapsed,
  hostActions
}: {
  activity: ReasoningActivityV1
  turnId: string
  defaultCollapsed: boolean
  hostActions: TranscriptHostActions
}): ReactElement {
  const [expanded, setExpanded] = useState(!defaultCollapsed)
  const contentId = useId()

  useEffect(() => setExpanded(!defaultCollapsed), [defaultCollapsed])

  return (
    <section className="leaffish-reasoning">
      <button
        type="button"
        className="leaffish-reasoning__toggle leaffish-disclosure"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((current) => !current)}
      >
        <ChevronRight
          className="leaffish-disclosure__chevron"
          data-expanded={expanded}
          aria-hidden="true"
        />
        <span>Reasoning</span>
      </button>
      {expanded ? (
        <div className="leaffish-reasoning__content" id={contentId}>
          <TranscriptContent
            content={activity.content}
            context={{ turnId, role: 'reasoning' }}
            {...hostActions}
          />
        </div>
      ) : null}
    </section>
  )
}

function ActivityItem({
  activity,
  turnId,
  preferences,
  hostActions
}: {
  activity: TranscriptActivityV1
  turnId: string
  preferences: TranscriptPreferencesV1
  hostActions: TranscriptHostActions
}): ReactElement {
  if (activity.kind === 'tool') {
    return <TranscriptToolRow tool={activity} defaultCollapsed={preferences.collapseToolDetails} />
  }
  if (activity.kind === 'reasoning') {
    return (
      <ReasoningRow
        activity={activity}
        turnId={turnId}
        defaultCollapsed={preferences.collapseReasoning}
        hostActions={hostActions}
      />
    )
  }
  return (
    <div className="leaffish-activity__assistant-note">
      <TranscriptContent
        content={activity.content}
        context={{ turnId, role: 'assistant' }}
        {...hostActions}
      />
    </div>
  )
}

export function TranscriptActivity({
  turn,
  preferences,
  hostActions
}: {
  turn: TranscriptTurnV1
  preferences: TranscriptPreferencesV1
  hostActions: TranscriptHostActions
}): ReactElement | null {
  // Why: the compact live view keeps only the latest tool visible;
  // users can still expand the turn or change the persisted global preference.
  const defaultExpanded = !preferences.collapseCompletedActivity
  const [expanded, setExpanded] = useState(defaultExpanded)
  const contentId = useId()

  useEffect(() => setExpanded(defaultExpanded), [defaultExpanded])

  if (turn.activity.length === 0) {
    return null
  }

  const summary = summarizeTurnActivity(turn)
  const folded = foldTurnActivity(turn, expanded)

  return (
    <section className="leaffish-activity">
      <button
        type="button"
        className="leaffish-activity__toggle leaffish-disclosure"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((current) => !current)}
      >
        <ChevronRight
          className="leaffish-disclosure__chevron"
          data-expanded={expanded}
          aria-hidden="true"
        />
        <span>{summary.label}</span>
      </button>
      <div className="leaffish-activity__content" id={contentId}>
        {!expanded && folded.hiddenCount > 0 && folded.visible.length > 0 ? (
          <div className="leaffish-activity__previous">
            +{folded.hiddenCount} previous {folded.hiddenCount === 1 ? 'event' : 'events'}
          </div>
        ) : null}
        {folded.visible.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            turnId={turn.id}
            preferences={preferences}
            hostActions={hostActions}
          />
        ))}
      </div>
    </section>
  )
}
