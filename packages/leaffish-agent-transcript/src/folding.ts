import type { TranscriptActivityV1, TranscriptTurnV1 } from './contract'

export type TurnActivitySummary = {
  toolCount: number
  reasoningCount: number
  elapsedMs?: number
  label: string
}

export type FoldedTurnActivity = {
  visible: TranscriptActivityV1[]
  hiddenCount: number
}

function durationLabel(elapsedMs: number): string {
  if (elapsedMs < 1_000) {
    return '<1s'
  }
  const totalSeconds = Math.round(elapsedMs / 1_000)
  if (totalSeconds < 60) {
    return `${totalSeconds}s`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
}

export function summarizeTurnActivity(turn: TranscriptTurnV1): TurnActivitySummary {
  const toolCount = turn.activity.filter((item) => item.kind === 'tool').length
  const reasoningCount = turn.activity.filter((item) => item.kind === 'reasoning').length
  const elapsedMs =
    turn.startedAt !== undefined && turn.completedAt !== undefined
      ? Math.max(0, turn.completedAt - turn.startedAt)
      : undefined
  const state =
    turn.status === 'working'
      ? 'Working'
      : elapsedMs === undefined
        ? 'Worked'
        : `Worked for ${durationLabel(elapsedMs)}`
  const toolLabel = `${toolCount} tool ${toolCount === 1 ? 'call' : 'calls'}`
  return { toolCount, reasoningCount, elapsedMs, label: `${state} · ${toolLabel}` }
}

/** Completed turns hide all activity; an active turn keeps only its latest tool visible. */
export function foldTurnActivity(turn: TranscriptTurnV1, expanded: boolean): FoldedTurnActivity {
  if (expanded) {
    return { visible: turn.activity, hiddenCount: 0 }
  }
  if (turn.status !== 'working') {
    return { visible: [], hiddenCount: turn.activity.length }
  }
  let latestToolIndex = -1
  for (let index = turn.activity.length - 1; index >= 0; index -= 1) {
    if (turn.activity[index].kind === 'tool') {
      latestToolIndex = index
      break
    }
  }
  if (latestToolIndex < 0) {
    return { visible: [], hiddenCount: turn.activity.length }
  }
  return {
    visible: [turn.activity[latestToolIndex]],
    hiddenCount: turn.activity.length - 1
  }
}

export function toolDurationMs(activity: TranscriptActivityV1): number | undefined {
  if (
    activity.kind !== 'tool' ||
    activity.startedAt === undefined ||
    activity.completedAt === undefined
  ) {
    return undefined
  }
  return Math.max(0, activity.completedAt - activity.startedAt)
}

export function formatToolDuration(elapsedMs: number | undefined): string | undefined {
  return elapsedMs === undefined ? undefined : durationLabel(elapsedMs)
}
