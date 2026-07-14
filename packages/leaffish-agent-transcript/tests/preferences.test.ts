import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TRANSCRIPT_PREFERENCES,
  readTranscriptPreferences,
  transcriptPreferenceKey,
  writeTranscriptPreferences,
  type PreferenceStorage
} from '../src/preferences'

function memoryStorage(): PreferenceStorage & { values: Map<string, string> } {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value)
  }
}

describe('transcript preferences', () => {
  it('uses a package, host, and schema-version namespace', () => {
    expect(transcriptPreferenceKey('orca/profile one')).toBe(
      'leaffish-agent-transcript:orca%2Fprofile%20one:preferences:v1'
    )
  })

  it('round-trips schema-versioned preferences', () => {
    const storage = memoryStorage()
    const preferences = { ...DEFAULT_TRANSCRIPT_PREFERENCES, expandChangedFiles: true }
    writeTranscriptPreferences('profile-1', preferences, storage)
    expect(readTranscriptPreferences('profile-1', storage)).toEqual(preferences)
  })

  it('falls back safely when stored data is corrupt or from another schema', () => {
    const storage = memoryStorage()
    storage.setItem(transcriptPreferenceKey('profile-1'), '{bad json')
    expect(readTranscriptPreferences('profile-1', storage)).toEqual(DEFAULT_TRANSCRIPT_PREFERENCES)
    storage.setItem(
      transcriptPreferenceKey('profile-1'),
      JSON.stringify({ ...DEFAULT_TRANSCRIPT_PREFERENCES, schemaVersion: 2 })
    )
    expect(readTranscriptPreferences('profile-1', storage)).toEqual(DEFAULT_TRANSCRIPT_PREFERENCES)
  })
})
