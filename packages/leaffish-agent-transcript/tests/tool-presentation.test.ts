import { describe, expect, it } from 'vitest'
import { summarizeTool, toolStatusLabel } from '../src/tool-presentation'

describe('tool presentation', () => {
  it('uses the host summary and collapses whitespace', () => {
    expect(
      summarizeTool({
        id: 'tool-1',
        kind: 'tool',
        name: 'Shell',
        status: 'succeeded',
        summary: 'pnpm   test\n--run'
      })
    ).toBe('pnpm test --run')
  })

  it('surfaces failed exit codes', () => {
    expect(
      toolStatusLabel({
        id: 'tool-1',
        kind: 'tool',
        name: 'Shell',
        status: 'failed',
        exitCode: 1
      })
    ).toBe('Failed (1)')
  })
})
