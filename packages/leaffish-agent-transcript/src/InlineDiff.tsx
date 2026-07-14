import type { ReactElement } from 'react'
import type { InlineDiffLineV1 } from './contract'

function prefix(kind: InlineDiffLineV1['kind']): string {
  if (kind === 'addition') {
    return '+'
  }
  if (kind === 'deletion') {
    return '-'
  }
  return ' '
}

export function InlineDiff({ lines }: { lines: readonly InlineDiffLineV1[] }): ReactElement {
  return (
    <div className="leaffish-diff" role="region" aria-label="Inline file changes">
      {lines.map((line, index) => (
        <div className="leaffish-diff__line" data-kind={line.kind} key={`${index}:${line.text}`}>
          <span className="leaffish-diff__old-line">{line.oldLine ?? ''}</span>
          <span className="leaffish-diff__new-line">{line.newLine ?? ''}</span>
          <span className="leaffish-diff__prefix" aria-hidden="true">
            {prefix(line.kind)}
          </span>
          <span className="leaffish-diff__text">{line.text}</span>
        </div>
      ))}
    </div>
  )
}
