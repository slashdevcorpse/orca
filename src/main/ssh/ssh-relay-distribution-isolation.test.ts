import { describe, expect, it } from 'vitest'
import { getAppDistributionDefinition } from '../../shared/app-distribution'
import { getRemoteHostPlatform } from './ssh-remote-platform'
import { isWindowsRelayPipePath, relayEndpointForHost } from './ssh-relay-endpoints'

describe('SSH relay distribution isolation', () => {
  const windows = getRemoteHostPlatform('win32-x64')

  it('keeps remote persistence namespaces disjoint', () => {
    const orca = getAppDistributionDefinition('orca').hostNamespaces
    const leaffish = getAppDistributionDefinition('leaffish').hostNamespaces

    expect(leaffish.sshRelayInstallDirectoryName).not.toBe(orca.sshRelayInstallDirectoryName)
    expect(leaffish.relayRuntimeDirectoryName).not.toBe(orca.relayRuntimeDirectoryName)
    expect(leaffish.managedHomeDirectoryName).not.toBe(orca.managedHomeDirectoryName)
    expect(leaffish.sshControlSocketDirectoryName).not.toBe(orca.sshControlSocketDirectoryName)
  })

  it('uses distribution-specific Windows relay pipes', () => {
    const orcaPipe = relayEndpointForHost(windows, 'C:/Users/me/.orca-remote/relay-1', 'relay.sock')
    const leaffishPipe = relayEndpointForHost(
      windows,
      'C:/Users/me/.leaffish-remote/relay-1',
      'relay.sock',
      'leaffish'
    )

    expect(orcaPipe).toMatch(/^\\\\\.\\pipe\\orca-relay-/)
    expect(leaffishPipe).toMatch(/^\\\\\.\\pipe\\leaffish-relay-/)
    expect(isWindowsRelayPipePath(orcaPipe)).toBe(true)
    expect(isWindowsRelayPipePath(leaffishPipe, 'leaffish')).toBe(true)
    expect(isWindowsRelayPipePath(orcaPipe, 'leaffish')).toBe(false)
  })
})
