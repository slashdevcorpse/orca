// Pure grouping logic for the native chat message list. Kept out of the .tsx so
// the pairing/ordering rules are unit-testable without rendering. Two jobs:
//   1. Order messages stably (timestamp then id; null timestamps sort first as
//      the shared model documents) — the assembler already sorts, but the list
//      re-sorts defensively so a caller passing unordered fixtures still reads
//      correctly.
//   2. Within an assistant turn, pair each tool-call block with the tool-result
//      that answers it so the view can render one collapsible step instead of
//      two disconnected rows.

import {
  isToolCallBlock,
  isToolResultBlock,
  type NativeChatBlock,
  type NativeChatMessage,
  type NativeChatToolCallBlock,
  type NativeChatToolResultBlock
} from '../../../../shared/native-chat-types'
import { compareMessages } from './native-chat-session-assembler'

/** A tool-call block paired with the result that answered it, when one exists.
 *  `result` is null while the call is still in flight (no result yet). */
export type NativeChatToolStep = {
  call: NativeChatToolCallBlock
  result: NativeChatToolResultBlock | null
}

/** One renderable item in the list: either a prose/role message carrying its
 *  non-tool blocks, or a tool step (call + optional result). The view renders
 *  each variant differently. */
export type NativeChatRenderItem =
  | {
      kind: 'message'
      id: string
      message: NativeChatMessage
      /** The message's blocks minus tool-call/tool-result (those become steps). */
      blocks: NativeChatBlock[]
    }
  | {
      kind: 'tool-step'
      id: string
      /** Role of the message the call originated from (assistant/tool). */
      role: NativeChatMessage['role']
      timestamp: number | null
      step: NativeChatToolStep
    }

/** Order messages stably: null timestamps first (model rule), then ascending
 *  timestamp, ties broken by id. Shares the assembler's comparator so both
 *  paths order identically. */
export function orderNativeChatMessages(messages: NativeChatMessage[]): NativeChatMessage[] {
  return [...messages].sort(compareMessages)
}

type ToolResultPairing = Map<NativeChatToolCallBlock, NativeChatToolResultBlock>

/** Pair provider-identified calls first, then retain document-order FIFO for
 *  legacy transcripts whose blocks do not carry correlation ids. */
function pairToolResults(messages: NativeChatMessage[]): ToolResultPairing {
  const calls: NativeChatToolCallBlock[] = []
  const results: NativeChatToolResultBlock[] = []
  for (const message of messages) {
    for (const block of message.blocks) {
      if (isToolCallBlock(block)) {
        calls.push(block)
      } else if (isToolResultBlock(block)) {
        results.push(block)
      }
    }
  }

  const pairings: ToolResultPairing = new Map()
  const consumedResults = results.map(() => false)
  const resultIndexesByCallId = new Map<string, number[]>()
  for (const [index, result] of results.entries()) {
    if (!result.callId) {
      continue
    }
    const indexes = resultIndexesByCallId.get(result.callId) ?? []
    indexes.push(index)
    resultIndexesByCallId.set(result.callId, indexes)
  }

  // Why: reserve exact matches before FIFO so an unlabelled earlier call cannot
  // consume a labelled result belonging to a later concurrent call.
  for (const call of calls) {
    if (!call.callId) {
      continue
    }
    const resultIndex = resultIndexesByCallId.get(call.callId)?.shift()
    if (resultIndex === undefined) {
      continue
    }
    pairings.set(call, results[resultIndex])
    consumedResults[resultIndex] = true
  }

  let resultCursor = 0
  for (const call of calls) {
    if (pairings.has(call)) {
      continue
    }
    while (consumedResults[resultCursor]) {
      resultCursor += 1
    }
    const result = results[resultCursor]
    if (!result) {
      break
    }
    pairings.set(call, result)
    consumedResults[resultCursor] = true
  }
  return pairings
}

/**
 * Flatten ordered messages into render items, pairing tool calls with results.
 * Provider call ids win even when results arrive out of order. Blocks without a
 * usable id retain the historical FIFO behavior. A call with no remaining
 * result renders as in-flight (`result: null`).
 */
export function buildNativeChatRenderItems(messages: NativeChatMessage[]): NativeChatRenderItem[] {
  const ordered = orderNativeChatMessages(messages)
  const resultPairings = pairToolResults(ordered)

  const items: NativeChatRenderItem[] = []
  for (const message of ordered) {
    const nonToolBlocks: NativeChatBlock[] = []
    const steps: NativeChatToolStep[] = []

    for (const block of message.blocks) {
      if (isToolCallBlock(block)) {
        steps.push({ call: block, result: resultPairings.get(block) ?? null })
      } else if (isToolResultBlock(block)) {
        // Results are emitted as steps from the call side; skip standalone ones.
        continue
      } else {
        nonToolBlocks.push(block)
      }
    }

    if (nonToolBlocks.length > 0) {
      items.push({ kind: 'message', id: message.id, message, blocks: nonToolBlocks })
    }
    for (const [index, step] of steps.entries()) {
      items.push({
        kind: 'tool-step',
        id: `${message.id}:tool:${index}`,
        role: message.role,
        timestamp: message.timestamp,
        step
      })
    }
  }
  return items
}
