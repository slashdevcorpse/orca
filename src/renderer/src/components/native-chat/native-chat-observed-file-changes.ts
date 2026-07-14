import type { ChangedFileV1, FileStatusV1, InlineDiffLineV1 } from '@leaffish/agent-transcript'
import { diffFromText, diffFromToolCall, type DiffLine } from './native-chat-diff'
import type { NativeChatToolStep } from './native-chat-message-grouping'

type ObservedChange = {
  path: string
  status: FileStatusV1
  lines: InlineDiffLineV1[]
}

type MutableChangedFile = ChangedFileV1 & { diff: InlineDiffLineV1[] }

function diffLines(lines: readonly DiffLine[]): InlineDiffLineV1[] {
  return lines.map((line) => ({
    kind:
      line.kind === 'add'
        ? 'addition'
        : line.kind === 'del'
          ? 'deletion'
          : line.kind === 'meta'
            ? 'header'
            : 'context',
    text: line.text
  }))
}

function toolPath(input: unknown): string | null {
  if (!input || typeof input !== 'object') {
    return null
  }
  const record = input as Record<string, unknown>
  const value = record.file_path ?? record.path ?? record.notebook_path ?? record.target_file
  return typeof value === 'string' && value.trim() ? value : null
}

function statusForTool(name: string): FileStatusV1 {
  const normalized = name.toLowerCase()
  if (normalized.includes('delete') || normalized.includes('remove')) {
    return 'deleted'
  }
  if (normalized.includes('create')) {
    return 'added'
  }
  return 'modified'
}

function appendChangedFile(files: Map<string, MutableChangedFile>, change: ObservedChange): void {
  const additions = change.lines.filter((line) => line.kind === 'addition').length
  const deletions = change.lines.filter((line) => line.kind === 'deletion').length
  const existing = files.get(change.path)
  if (existing) {
    existing.status = change.status
    existing.additions += additions
    existing.deletions += deletions
    existing.diff.push(...change.lines)
    return
  }
  files.set(change.path, {
    id: `file:${change.path}`,
    file: { id: change.path, displayPath: change.path },
    status: change.status,
    additions,
    deletions,
    diff: [...change.lines]
  })
}

function lineKind(line: string): InlineDiffLineV1['kind'] {
  if (line.startsWith('+') && !line.startsWith('+++')) {
    return 'addition'
  }
  if (line.startsWith('-') && !line.startsWith('---')) {
    return 'deletion'
  }
  return line.startsWith('@@') || line.startsWith('diff ') ? 'header' : 'context'
}

function patchMarkerChanges(value: unknown): ObservedChange[] {
  if (typeof value !== 'string') {
    return []
  }
  const changes: ObservedChange[] = []
  let current: ObservedChange | null = null
  for (const line of value.split('\n')) {
    const marker = /^\*\*\* (Update|Add|Delete) File: (.+)$/.exec(line)
    if (marker) {
      current = {
        path: marker[2].trim(),
        status: marker[1] === 'Add' ? 'added' : marker[1] === 'Delete' ? 'deleted' : 'modified',
        lines: [{ kind: 'header', text: line }]
      }
      changes.push(current)
      continue
    }
    if (current && !line.startsWith('*** End Patch')) {
      current.lines.push({ kind: lineKind(line), text: line.replace(/^[+-]/, '') })
    }
  }
  return changes
}

function unifiedDiffChanges(value: unknown): ObservedChange[] {
  if (typeof value !== 'string') {
    return []
  }
  const changes: ObservedChange[] = []
  let current: ObservedChange | null = null
  for (const line of value.split('\n')) {
    const header = /^diff --git a\/(.+) b\/(.+)$/.exec(line)
    if (header) {
      current = {
        path: header[2],
        status: 'modified',
        lines: [{ kind: 'header', text: line }]
      }
      changes.push(current)
      continue
    }
    if (!current) {
      continue
    }
    if (line.startsWith('new file mode ')) {
      current.status = 'added'
    } else if (line.startsWith('deleted file mode ')) {
      current.status = 'deleted'
    } else if (line.startsWith('rename to ')) {
      current.status = 'renamed'
      current.path = line.slice('rename to '.length)
    }
    current.lines.push({ kind: lineKind(line), text: line.replace(/^[+-]/, '') })
  }
  return changes
}

function inputRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

export function changedFilesFromToolSteps(steps: readonly NativeChatToolStep[]): ChangedFileV1[] {
  const files = new Map<string, MutableChangedFile>()
  for (const { call, result } of steps) {
    const input = inputRecord(call.input)
    const structured = [
      ...patchMarkerChanges(input?.patch ?? input?.patch_text),
      ...unifiedDiffChanges(input?.patch ?? input?.patch_text),
      ...unifiedDiffChanges(result?.output)
    ]
    for (const change of structured) {
      appendChangedFile(files, change)
    }

    const path = toolPath(call.input)
    if (!path || structured.some((change) => change.path === path)) {
      continue
    }
    const detected = diffFromToolCall(call.name, call.input) ?? diffFromText(result?.output ?? '')
    appendChangedFile(files, {
      path,
      status: statusForTool(call.name),
      lines: detected ? diffLines(detected) : []
    })
  }
  return [...files.values()].map((file) => ({
    ...file,
    diff: file.diff.length ? file.diff : undefined
  }))
}
