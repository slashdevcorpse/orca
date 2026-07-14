export const ORCA_MANAGED_PI_EXTENSION_MARKER = '@orca-managed-pi-extension'

const SHARED_STATUS_BRIDGE_PROTOCOL_VERSION = 1
// Why: same/newer revisions are deliberately reused across Orca and Leaffish.
// Bump this whenever the generated status bridge behavior changes.
const SHARED_STATUS_BRIDGE_REVISION = 1

export const SHARED_PI_STATUS_BRIDGE_MARKER = `@orca-shared-pi-status-bridge protocol=${SHARED_STATUS_BRIDGE_PROTOCOL_VERSION} revision=${SHARED_STATUS_BRIDGE_REVISION}`

export type SharedPiStatusBridgeDecision = 'replace' | 'reuse' | 'user-owned'

export function withSharedPiStatusBridgeMarker(source: string): string {
  const managedSource = source.includes(ORCA_MANAGED_PI_EXTENSION_MARKER)
    ? source
    : `// ${ORCA_MANAGED_PI_EXTENSION_MARKER}\n${source}`
  return managedSource.includes(SHARED_PI_STATUS_BRIDGE_MARKER)
    ? managedSource
    : `// ${SHARED_PI_STATUS_BRIDGE_MARKER}\n${managedSource}`
}

export function getSharedPiStatusBridgeDecision(
  existingSource: string | null
): SharedPiStatusBridgeDecision {
  if (existingSource === null) {
    return 'replace'
  }
  if (!existingSource.includes(ORCA_MANAGED_PI_EXTENSION_MARKER)) {
    return 'user-owned'
  }
  const sharedMarker = existingSource.match(
    /@orca-shared-pi-status-bridge protocol=(\d+) revision=(\d+)/
  )
  if (!sharedMarker) {
    // Why: upgrade the legacy Orca-owned file once into the shared bridge contract.
    return 'replace'
  }
  const protocolVersion = Number(sharedMarker[1])
  const revision = Number(sharedMarker[2])
  // Why: Pi auto-loads one real-home slot. Reusing a same/newer bridge avoids
  // Orca and Leaffish replacing each other's source while env selects the receiver.
  return protocolVersion !== SHARED_STATUS_BRIDGE_PROTOCOL_VERSION ||
    revision >= SHARED_STATUS_BRIDGE_REVISION
    ? 'reuse'
    : 'replace'
}
