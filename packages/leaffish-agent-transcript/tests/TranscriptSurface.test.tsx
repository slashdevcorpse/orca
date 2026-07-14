import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TranscriptSurface, type TranscriptDocumentV1 } from '../src'

function document(status: 'completed' | 'working'): TranscriptDocumentV1 {
  return {
    schemaVersion: 1,
    sessionId: 'session',
    status,
    turns: [
      {
        id: 'turn',
        status,
        request: { markdown: 'Please update the view.' },
        activity: [
          {
            id: 'first',
            kind: 'tool',
            name: 'Read',
            status: 'succeeded',
            summary: 'old.ts'
          },
          {
            id: 'latest',
            kind: 'tool',
            name: 'Edit',
            status: status === 'working' ? 'running' : 'succeeded',
            summary: 'view.tsx'
          }
        ],
        finalResponse: status === 'completed' ? { markdown: 'The view is updated.' } : undefined
      }
    ]
  }
}

describe('TranscriptSurface server rendering', () => {
  it('keeps final prose visible while completed commands start collapsed', () => {
    const html = renderToStaticMarkup(
      createElement(TranscriptSurface, {
        document: document('completed'),
        preferenceNamespace: 'test'
      })
    )

    expect(html).toContain('The view is updated.')
    expect(html).toContain('Worked · 2 tool calls')
    expect(html).not.toContain('old.ts')
    expect(html).not.toContain('view.tsx')
  })

  it('shows only the latest command and prior-event count for a working turn', () => {
    const html = renderToStaticMarkup(
      createElement(TranscriptSurface, {
        document: document('working'),
        preferenceNamespace: 'test'
      })
    )

    expect(html).toContain('+1 previous event')
    expect(html).toContain('view.tsx')
    expect(html).not.toContain('old.ts')
  })
})
