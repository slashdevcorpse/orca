import { describe, expect, it } from 'vitest'
import type { NativeChatMessage, NativeChatSession } from '../../../../shared/native-chat-types'
import { nativeChatSessionToLeaffishDocument } from './native-chat-leaffish-document'

function message(
  id: string,
  role: NativeChatMessage['role'],
  blocks: NativeChatMessage['blocks'],
  timestamp: number
): NativeChatMessage {
  return { id, role, blocks, timestamp, source: 'transcript' }
}

function session(messages: NativeChatMessage[]): NativeChatSession {
  return {
    messages,
    status: 'ready',
    sessionId: 'session-1',
    agent: 'codex'
  }
}

describe('nativeChatSessionToLeaffishDocument', () => {
  it('keeps the final explanation outside folded activity and pairs tool results by id', () => {
    const document = nativeChatSessionToLeaffishDocument(
      session([
        message('user', 'user', [{ type: 'text', text: 'Improve the terminal view' }], 1),
        message('note', 'assistant', [{ type: 'text', text: 'I will inspect the renderer.' }], 2),
        message(
          'calls',
          'assistant',
          [
            {
              type: 'tool-call',
              name: 'Edit',
              callId: 'edit-1',
              input: {
                file_path: 'src/TerminalView.tsx',
                old_string: 'expanded',
                new_string: 'collapsed'
              }
            },
            { type: 'tool-call', name: 'Bash', callId: 'test-1', input: { command: 'pnpm test' } }
          ],
          3
        ),
        message(
          'results',
          'tool',
          [
            { type: 'tool-result', callId: 'test-1', output: 'passed' },
            { type: 'tool-result', callId: 'edit-1', output: 'updated' }
          ],
          4
        ),
        message('final', 'assistant', [{ type: 'text', text: 'The commands now collapse.' }], 5)
      ]),
      false
    )

    expect(document).toMatchObject({ schemaVersion: 1, sessionId: 'session-1' })
    expect(document.turns).toHaveLength(1)
    expect(document.turns[0].request?.markdown).toBe('Improve the terminal view')
    expect(document.turns[0].finalResponse?.markdown).toBe('The commands now collapse.')
    expect(document.turns[0].activity.map((activity) => activity.kind)).toEqual([
      'assistant-note',
      'tool',
      'tool'
    ])
    expect(document.turns[0].activity[1]).toMatchObject({
      kind: 'tool',
      id: 'edit-1',
      output: 'updated',
      status: 'succeeded'
    })
    expect(document.turns[0].changedFiles).toEqual([
      expect.objectContaining({
        status: 'modified',
        additions: 1,
        deletions: 1,
        file: { id: 'src/TerminalView.tsx', displayPath: 'src/TerminalView.tsx' }
      })
    ])
  })

  it('marks only the latest turn working and keeps its unresolved tool running', () => {
    const document = nativeChatSessionToLeaffishDocument(
      session([
        message('user-1', 'user', [{ type: 'text', text: 'First' }], 1),
        message('answer-1', 'assistant', [{ type: 'text', text: 'Complete' }], 2),
        message('user-2', 'user', [{ type: 'text', text: 'Second' }], 3),
        message(
          'call-2',
          'assistant',
          [{ type: 'tool-call', callId: 'running-1', name: 'Bash', input: { command: 'build' } }],
          4
        )
      ]),
      true
    )

    expect(document.status).toBe('working')
    expect(document.turns.map((turn) => turn.status)).toEqual(['completed', 'working'])
    expect(document.turns[1].activity[0]).toMatchObject({
      id: 'running-1',
      kind: 'tool',
      status: 'running'
    })
  })

  it('preserves failed delivery when the provider turn id differs from the message id', () => {
    const user = {
      ...message('optimistic-message', 'user', [{ type: 'text' as const, text: 'Send me' }], 1),
      turnId: 'provider-turn'
    }
    const document = nativeChatSessionToLeaffishDocument(
      session([user]),
      false,
      new Set(['optimistic-message'])
    )

    expect(document.turns[0]).toMatchObject({
      id: 'provider-turn',
      requestDelivery: 'failed'
    })
  })

  it('extracts each file from an apply-patch payload for the changed-file tree', () => {
    const document = nativeChatSessionToLeaffishDocument(
      session([
        message('user', 'user', [{ type: 'text', text: 'Patch files' }], 1),
        message(
          'patch',
          'assistant',
          [
            {
              type: 'tool-call',
              name: 'apply_patch',
              input: {
                patch: [
                  '*** Begin Patch',
                  '*** Update File: src/a.ts',
                  '-old',
                  '+new',
                  '*** Add File: src/b.ts',
                  '+created',
                  '*** End Patch'
                ].join('\n')
              }
            }
          ],
          2
        )
      ]),
      false
    )

    expect(document.turns[0].changedFiles).toMatchObject([
      { status: 'modified', additions: 1, deletions: 1, file: { displayPath: 'src/a.ts' } },
      { status: 'added', additions: 1, deletions: 0, file: { displayPath: 'src/b.ts' } }
    ])
  })

  it('extracts multi-file unified diffs emitted by command tools', () => {
    const document = nativeChatSessionToLeaffishDocument(
      session([
        message('user', 'user', [{ type: 'text', text: 'Run the formatter' }], 1),
        message(
          'call',
          'assistant',
          [{ type: 'tool-call', callId: 'format', name: 'Bash', input: { command: 'format' } }],
          2
        ),
        message(
          'result',
          'tool',
          [
            {
              type: 'tool-result',
              callId: 'format',
              output: [
                'diff --git a/src/a.ts b/src/a.ts',
                '@@ -1 +1 @@',
                '-old',
                '+new',
                'diff --git a/src/new.ts b/src/new.ts',
                'new file mode 100644',
                '+created'
              ].join('\n')
            }
          ],
          3
        )
      ]),
      false
    )

    expect(document.turns[0].changedFiles).toMatchObject([
      { status: 'modified', additions: 1, deletions: 1, file: { displayPath: 'src/a.ts' } },
      { status: 'added', additions: 1, deletions: 0, file: { displayPath: 'src/new.ts' } }
    ])
  })
})
