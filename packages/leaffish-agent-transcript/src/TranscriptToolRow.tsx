import { useEffect, useId, useState, type ReactElement } from 'react'
import { ChevronRight } from 'lucide-react'
import type { ToolExecutionV1 } from './contract'
import { formatToolDuration, toolDurationMs } from './folding'
import { summarizeTool, toolStatusLabel } from './tool-presentation'

function detailText(value: ToolExecutionV1['input']): string {
  if (typeof value === 'string') {
    return value
  }
  if (value === undefined) {
    return ''
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}

export function TranscriptToolRow({
  tool,
  defaultCollapsed
}: {
  tool: ToolExecutionV1
  defaultCollapsed: boolean
}): ReactElement {
  const [expanded, setExpanded] = useState(!defaultCollapsed)
  const detailId = useId()
  const input = detailText(tool.input)
  const hasDetail = input.length > 0 || Boolean(tool.output)
  const duration = formatToolDuration(toolDurationMs(tool))

  useEffect(() => setExpanded(!defaultCollapsed), [defaultCollapsed])

  return (
    <div className="leaffish-tool" data-status={tool.status}>
      <button
        type="button"
        className="leaffish-tool__row leaffish-disclosure"
        aria-expanded={hasDetail ? expanded : undefined}
        aria-controls={hasDetail ? detailId : undefined}
        onClick={() => hasDetail && setExpanded((current) => !current)}
      >
        <ChevronRight
          className="leaffish-disclosure__chevron"
          data-expanded={expanded}
          data-hidden={!hasDetail}
          aria-hidden="true"
        />
        <span className="leaffish-tool__status-dot" aria-hidden="true" />
        <span className="leaffish-tool__name">{tool.name}</span>
        <span className="leaffish-tool__summary" title={summarizeTool(tool)}>
          {summarizeTool(tool)}
        </span>
        <span className="leaffish-tool__meta">
          {duration ? `${duration} · ` : ''}
          {toolStatusLabel(tool)}
        </span>
      </button>
      {hasDetail && expanded ? (
        <div className="leaffish-tool__detail" id={detailId}>
          {input ? (
            <section>
              <h4>Input</h4>
              <pre>{input}</pre>
            </section>
          ) : null}
          {tool.output ? (
            <section>
              <h4>Output</h4>
              <pre data-error={tool.status === 'failed' || undefined}>{tool.output}</pre>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
