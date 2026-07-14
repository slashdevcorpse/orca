import type { JsonValue, ToolExecutionV1 } from './contract'

const MAX_SUMMARY_LENGTH = 96

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function jsonPreview(value: JsonValue): string {
  if (typeof value === 'string') {
    return value
  }
  if (value === null || typeof value === 'number' || typeof value === 'boolean') {
    return String(value ?? '')
  }
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

export function summarizeTool(tool: ToolExecutionV1): string {
  const raw = tool.summary ?? (tool.input === undefined ? '' : jsonPreview(tool.input))
  const summary = collapseWhitespace(raw)
  return summary.length <= MAX_SUMMARY_LENGTH
    ? summary
    : `${summary.slice(0, MAX_SUMMARY_LENGTH - 1)}…`
}

export function toolStatusLabel(tool: ToolExecutionV1): string {
  if (tool.status === 'failed' && tool.exitCode !== undefined) {
    return `Failed (${tool.exitCode})`
  }
  return tool.status.charAt(0).toUpperCase() + tool.status.slice(1)
}
