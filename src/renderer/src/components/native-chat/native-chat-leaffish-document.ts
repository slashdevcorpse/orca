import type {
  JsonValue,
  MarkdownContentV1,
  ToolExecutionV1,
  TranscriptActivityV1,
  TranscriptDocumentV1,
  TranscriptTurnV1
} from '@leaffish/agent-transcript'
import {
  isImageRefBlock,
  isTextBlock,
  type NativeChatBlock,
  type NativeChatMessage,
  type NativeChatSession
} from '../../../../shared/native-chat-types'
import {
  buildNativeChatRenderItems,
  orderNativeChatMessages,
  type NativeChatToolStep
} from './native-chat-message-grouping'
import { changedFilesFromToolSteps } from './native-chat-observed-file-changes'
import { stripNoiseMessages } from './native-chat-noise'
import { briefToolArg } from './native-chat-tool-summary'

type TurnMessages = {
  id: string
  messages: NativeChatMessage[]
}

function asJsonValue(value: unknown): JsonValue | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value)
  }
  if (Array.isArray(value)) {
    return value.map((item) => asJsonValue(item) ?? null)
  }
  if (typeof value !== 'object') {
    return value === undefined ? undefined : String(value)
  }
  const result: Record<string, JsonValue> = {}
  for (const [key, item] of Object.entries(value)) {
    const converted = asJsonValue(item)
    if (converted !== undefined) {
      result[key] = converted
    }
  }
  return result
}

function contentFromBlocks(blocks: readonly NativeChatBlock[]): MarkdownContentV1 | undefined {
  const markdown = blocks
    .filter(isTextBlock)
    .map((block) => block.text)
    .filter(Boolean)
    .join('\n\n')
  const images = blocks.filter(isImageRefBlock).map((image, index) => {
    const sourceId = image.path ?? image.url ?? image.alt ?? `image-${index}`
    return {
      id: `image:${index}:${sourceId}`,
      sourceId,
      ...(image.alt ? { alt: image.alt } : {}),
      label: image.alt ?? image.path ?? image.url ?? 'Image'
    }
  })
  if (!markdown && images.length === 0) {
    return undefined
  }
  return { markdown, ...(images.length > 0 ? { images } : {}) }
}

function partitionTurns(messages: NativeChatMessage[]): TurnMessages[] {
  const turns: TurnMessages[] = []
  for (const message of messages) {
    if (message.role === 'user' || turns.length === 0) {
      turns.push({ id: message.turnId ?? message.id, messages: [message] })
      continue
    }
    turns.at(-1)?.messages.push(message)
  }
  return turns
}

function toolActivity(id: string, step: NativeChatToolStep): ToolExecutionV1 {
  const { call, result } = step
  const summary = briefToolArg(call.input)
  return {
    id: call.callId ?? id,
    kind: 'tool',
    name: call.name || 'Tool',
    status: result ? (result.isError ? 'failed' : 'succeeded') : 'running',
    ...(summary ? { summary } : {}),
    ...(asJsonValue(call.input) !== undefined ? { input: asJsonValue(call.input) } : {}),
    ...(result?.output ? { output: result.output } : {})
  }
}

function turnFromMessages(
  group: TurnMessages,
  index: number,
  total: number,
  isWorking: boolean,
  failedDeliveryMessageIds?: ReadonlySet<string>
): TranscriptTurnV1 {
  const requestBlocks = group.messages
    .filter((message) => message.role === 'user')
    .flatMap((message) => message.blocks)
  const request = contentFromBlocks(requestBlocks)
  const renderItems = buildNativeChatRenderItems(group.messages)
  const lastToolIndex = renderItems.findLastIndex((item) => item.kind === 'tool-step')
  const finalAssistantIndex = renderItems.findLastIndex(
    (item) => item.kind === 'message' && item.message.role === 'assistant'
  )
  // Why: assistant prose before a tool call explains ongoing work; only prose
  // after the last call is the durable final response that stays outside folds.
  const finalIndex = finalAssistantIndex > lastToolIndex ? finalAssistantIndex : -1
  const activity: TranscriptActivityV1[] = []
  let finalResponse: MarkdownContentV1 | undefined
  const steps: NativeChatToolStep[] = []

  renderItems.forEach((item, itemIndex) => {
    if (item.kind === 'tool-step') {
      steps.push(item.step)
      activity.push(toolActivity(item.id, item.step))
      return
    }
    if (item.message.role === 'user') {
      return
    }
    const content = contentFromBlocks(item.blocks)
    if (!content) {
      return
    }
    if (itemIndex === finalIndex) {
      finalResponse = content
      return
    }
    activity.push({
      id: item.id,
      kind: item.message.role === 'reasoning' ? 'reasoning' : 'assistant-note',
      content,
      ...(item.message.timestamp === null ? {} : { timestamp: item.message.timestamp })
    })
  })

  const failed = steps.some((step) => step.result?.isError)
  const working = index === total - 1 && isWorking
  const timestamps = group.messages.flatMap((message) =>
    message.timestamp === null ? [] : [message.timestamp]
  )
  const changedFiles = changedFilesFromToolSteps(steps)
  const deliveryFailed = group.messages.some(
    (message) => message.role === 'user' && failedDeliveryMessageIds?.has(message.id)
  )
  return {
    id: group.id,
    status: working ? 'working' : failed ? 'failed' : 'completed',
    ...(request ? { request } : {}),
    ...(deliveryFailed ? { requestDelivery: 'failed' } : {}),
    activity,
    ...(finalResponse ? { finalResponse } : {}),
    ...(changedFiles.length ? { changedFiles } : {}),
    ...(timestamps.length ? { startedAt: Math.min(...timestamps) } : {}),
    ...(!working && timestamps.length ? { completedAt: Math.max(...timestamps) } : {})
  }
}

export function nativeChatSessionToLeaffishDocument(
  session: NativeChatSession,
  isWorking: boolean,
  failedDeliveryMessageIds?: ReadonlySet<string>
): TranscriptDocumentV1 {
  const messages = orderNativeChatMessages(stripNoiseMessages(session.messages))
  const groups = partitionTurns(messages)
  return {
    schemaVersion: 1,
    sessionId: session.sessionId ?? `pending:${session.agent}`,
    status: isWorking ? 'working' : session.status === 'error' ? 'failed' : 'completed',
    turns: groups.map((group, index) =>
      turnFromMessages(group, index, groups.length, isWorking, failedDeliveryMessageIds)
    )
  }
}
