import { describe, expect, it } from 'vitest'
import { foldTurnActivity, formatToolDuration, summarizeTurnActivity } from '../src/folding'
import type { TranscriptTurnV1 } from '../src/contract'

function completedTurn(): TranscriptTurnV1 {
  return {
    id: 'turn-1',
    status: 'completed',
    startedAt: 1_000,
    completedAt: 66_000,
    activity: [
      { id: 'reasoning-1', kind: 'reasoning', content: { markdown: 'Planning' } },
      { id: 'tool-1', kind: 'tool', name: 'Read', status: 'succeeded' },
      { id: 'tool-2', kind: 'tool', name: 'Edit', status: 'succeeded' }
    ],
    finalResponse: { markdown: 'The change is complete.' }
  }
}

describe('turn activity folding', () => {
  it('collapses completed activity without consuming the final response', () => {
    const turn = completedTurn()
    expect(foldTurnActivity(turn, false)).toEqual({ visible: [], hiddenCount: 3 })
    expect(turn.finalResponse?.markdown).toBe('The change is complete.')
  })

  it('keeps only the latest tool visible while a collapsed turn is working', () => {
    const turn = { ...completedTurn(), status: 'working' as const, completedAt: undefined }
    const folded = foldTurnActivity(turn, false)
    expect(folded.visible.map((item) => item.id)).toEqual(['tool-2'])
    expect(folded.hiddenCount).toBe(2)
  })

  it('returns every activity item when expanded', () => {
    expect(foldTurnActivity(completedTurn(), true).visible).toHaveLength(3)
  })

  it('summarizes tool count and elapsed time', () => {
    expect(summarizeTurnActivity(completedTurn()).label).toBe('Worked for 1m 5s · 2 tool calls')
    expect(formatToolDuration(900)).toBe('<1s')
  })
})
