import { useCallback, useEffect, useMemo, useState } from 'react'

export const TRANSCRIPT_PREFERENCES_SCHEMA_VERSION = 1 as const

export type TranscriptPreferencesV1 = {
  schemaVersion: typeof TRANSCRIPT_PREFERENCES_SCHEMA_VERSION
  collapseCompletedActivity: boolean
  collapseReasoning: boolean
  collapseToolDetails: boolean
  expandChangedFiles: boolean
  expandFileDiffs: boolean
}

export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

export const DEFAULT_TRANSCRIPT_PREFERENCES: TranscriptPreferencesV1 = {
  schemaVersion: TRANSCRIPT_PREFERENCES_SCHEMA_VERSION,
  collapseCompletedActivity: true,
  collapseReasoning: true,
  collapseToolDetails: true,
  expandChangedFiles: false,
  expandFileDiffs: false
}

export function transcriptPreferenceKey(namespace: string): string {
  const safeNamespace = encodeURIComponent(namespace.trim() || 'default')
  return `leaffish-agent-transcript:${safeNamespace}:preferences:v1`
}

export function readTranscriptPreferences(
  namespace: string,
  storage?: PreferenceStorage
): TranscriptPreferencesV1 {
  if (!storage) {
    return DEFAULT_TRANSCRIPT_PREFERENCES
  }
  try {
    const raw = storage.getItem(transcriptPreferenceKey(namespace))
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (!isPreferenceRecord(parsed)) {
      return DEFAULT_TRANSCRIPT_PREFERENCES
    }
    return { ...DEFAULT_TRANSCRIPT_PREFERENCES, ...parsed }
  } catch {
    return DEFAULT_TRANSCRIPT_PREFERENCES
  }
}

export function writeTranscriptPreferences(
  namespace: string,
  preferences: TranscriptPreferencesV1,
  storage?: PreferenceStorage
): void {
  if (!storage) {
    return
  }
  try {
    storage.setItem(transcriptPreferenceKey(namespace), JSON.stringify(preferences))
  } catch {
    // Storage can be unavailable in hardened or quota-limited renderer contexts.
  }
}

function isPreferenceRecord(value: unknown): value is TranscriptPreferencesV1 {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    record.schemaVersion === TRANSCRIPT_PREFERENCES_SCHEMA_VERSION &&
    typeof record.collapseCompletedActivity === 'boolean' &&
    typeof record.collapseReasoning === 'boolean' &&
    typeof record.collapseToolDetails === 'boolean' &&
    typeof record.expandChangedFiles === 'boolean' &&
    typeof record.expandFileDiffs === 'boolean'
  )
}

function browserStorage(): PreferenceStorage | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function useTranscriptPreferences(
  namespace: string,
  storage?: PreferenceStorage
): {
  preferences: TranscriptPreferencesV1
  updatePreferences: (patch: Partial<Omit<TranscriptPreferencesV1, 'schemaVersion'>>) => void
} {
  const resolvedStorage = useMemo(() => storage ?? browserStorage(), [storage])
  const [preferences, setPreferences] = useState(() =>
    readTranscriptPreferences(namespace, resolvedStorage)
  )

  useEffect(() => {
    setPreferences(readTranscriptPreferences(namespace, resolvedStorage))
  }, [namespace, resolvedStorage])

  const updatePreferences = useCallback(
    (patch: Partial<Omit<TranscriptPreferencesV1, 'schemaVersion'>>) => {
      setPreferences((current) => {
        const next = { ...current, ...patch }
        writeTranscriptPreferences(namespace, next, resolvedStorage)
        return next
      })
    },
    [namespace, resolvedStorage]
  )

  return { preferences, updatePreferences }
}
