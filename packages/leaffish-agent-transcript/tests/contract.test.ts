import { describe, expect, it } from 'vitest'
import {
  assertTranscriptDocumentV1,
  isTranscriptDocumentV1,
  TRANSCRIPT_SCHEMA_VERSION,
  type TranscriptDocumentV1
} from '../src/contract'

const document: TranscriptDocumentV1 = {
  schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
  sessionId: 'session-1',
  status: 'completed',
  turns: [
    {
      id: 'turn-1',
      status: 'completed',
      requestDelivery: 'failed',
      request: {
        markdown: 'Inspect this image',
        images: [{ id: 'image-1', sourceId: 'host-image-1', alt: 'Screenshot' }]
      },
      activity: [],
      finalResponse: { markdown: 'Done.' }
    }
  ]
}

describe('transcript contract', () => {
  it('accepts the versioned JSON boundary including opaque image references', () => {
    expect(isTranscriptDocumentV1(document)).toBe(true)
    expect(() => assertTranscriptDocumentV1(document)).not.toThrow()
  })

  it('rejects documents from an unsupported schema version', () => {
    expect(isTranscriptDocumentV1({ ...document, schemaVersion: 2 })).toBe(false)
    expect(() => assertTranscriptDocumentV1({ ...document, schemaVersion: 2 })).toThrow(
      /schemaVersion 1/
    )
  })

  it('rejects malformed turn collections', () => {
    expect(isTranscriptDocumentV1({ ...document, turns: [{ id: 'turn-1' }] })).toBe(false)
  })
})
