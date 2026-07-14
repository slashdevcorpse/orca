export const TRANSCRIPT_SCHEMA_VERSION = 1 as const

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type TranscriptSessionStatusV1 = 'idle' | 'working' | 'completed' | 'failed'
export type TranscriptTurnStatusV1 = 'working' | 'completed' | 'failed' | 'cancelled'
export type ToolStatusV1 = 'queued' | 'running' | 'succeeded' | 'failed' | 'denied'
export type FileStatusV1 = 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'untracked'

export type FileReferenceV1 = {
  /** Host-owned identity; the package never turns it into a local filesystem path. */
  id: string
  displayPath: string
}

export type ImageReferenceV1 = {
  id: string
  /** Opaque host identity avoids leaking local or SSH paths into the package. */
  sourceId: string
  alt?: string
  label?: string
}

export type MarkdownContentV1 = {
  markdown: string
  images?: ImageReferenceV1[]
}

export type AssistantNoteActivityV1 = {
  id: string
  kind: 'assistant-note'
  content: MarkdownContentV1
  timestamp?: number
}

export type ReasoningActivityV1 = {
  id: string
  kind: 'reasoning'
  content: MarkdownContentV1
  timestamp?: number
}

export type ToolExecutionV1 = {
  id: string
  kind: 'tool'
  name: string
  status: ToolStatusV1
  summary?: string
  input?: JsonValue
  output?: string
  startedAt?: number
  completedAt?: number
  exitCode?: number
}

export type TranscriptActivityV1 = AssistantNoteActivityV1 | ReasoningActivityV1 | ToolExecutionV1

export type InlineDiffLineV1 = {
  kind: 'header' | 'context' | 'addition' | 'deletion'
  text: string
  oldLine?: number
  newLine?: number
}

export type ChangedFileV1 = {
  id: string
  file: FileReferenceV1
  status: FileStatusV1
  additions: number
  deletions: number
  previousDisplayPath?: string
  diff?: InlineDiffLineV1[]
}

export type TranscriptTurnV1 = {
  id: string
  status: TranscriptTurnStatusV1
  request?: MarkdownContentV1
  requestDelivery?: 'sent' | 'failed'
  activity: TranscriptActivityV1[]
  /** Kept outside folded activity so the final explanation is always visible. */
  finalResponse?: MarkdownContentV1
  changedFiles?: ChangedFileV1[]
  startedAt?: number
  completedAt?: number
}

export type TranscriptDocumentV1 = {
  schemaVersion: typeof TRANSCRIPT_SCHEMA_VERSION
  sessionId: string
  status: TranscriptSessionStatusV1
  turns: TranscriptTurnV1[]
}

export type TranscriptDocument = TranscriptDocumentV1

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Runtime check at the host/package boundary; deeper field validation stays with the host adapter. */
export function isTranscriptDocumentV1(value: unknown): value is TranscriptDocumentV1 {
  if (!isRecord(value)) {
    return false
  }
  return (
    value.schemaVersion === TRANSCRIPT_SCHEMA_VERSION &&
    typeof value.sessionId === 'string' &&
    typeof value.status === 'string' &&
    Array.isArray(value.turns) &&
    value.turns.every(
      (turn) =>
        isRecord(turn) &&
        typeof turn.id === 'string' &&
        typeof turn.status === 'string' &&
        Array.isArray(turn.activity)
    )
  )
}

export function assertTranscriptDocumentV1(value: unknown): asserts value is TranscriptDocumentV1 {
  if (!isTranscriptDocumentV1(value)) {
    throw new TypeError('Expected a Leaffish transcript document with schemaVersion 1')
  }
}
