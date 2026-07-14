import { describe, expect, it } from 'vitest'
import {
  getAppDistributionDefinition,
  resolveAppDistribution,
  resolveLeaffishUpdateFeedUrl
} from './app-distribution'

describe('app distribution', () => {
  it('keeps Orca as the default distribution', () => {
    expect(resolveAppDistribution(undefined)).toBe('orca')
    expect(getAppDistributionDefinition('orca')).toMatchObject({
      appId: 'com.stablyai.orca',
      cliCommandName: 'orca',
      name: 'Orca',
      userDataDirectoryName: 'orca'
    })
  })

  it('provides isolated Leaffish namespaces', () => {
    expect(resolveAppDistribution('leaffish')).toBe('leaffish')
    expect(getAppDistributionDefinition('leaffish')).toEqual({
      appId: 'com.slashdevcorpse.leaffish',
      cliCommandName: 'leaffish',
      daemonHostExecutableName: 'leaffish-terminal-daemon.exe',
      hostNamespaces: {
        managedHomeDirectoryName: '.leaffish',
        relayRuntimeDirectoryName: '.leaffish-relay',
        sshControlSocketDirectoryName: 'leaffish-ssh',
        sshRelayInstallDirectoryName: '.leaffish-remote',
        sshRelayPipePrefix: 'leaffish-relay',
        sshRelaySentinelName: 'LEAFFISH-RELAY',
        wslCliBridgeFileName: 'leaffish-wsl-bridge.ps1',
        wslCliCommandName: 'leaffish',
        wslCliDataDirectoryName: 'leaffish',
        wslLegacyCliCommandNames: []
      },
      localDataDirectoryName: 'Leaffish',
      name: 'Leaffish',
      userDataDirectoryName: 'leaffish'
    })
  })

  it('accepts only HTTPS Leaffish update feeds', () => {
    expect(resolveLeaffishUpdateFeedUrl('https://updates.example.com/leaffish/')).toBe(
      'https://updates.example.com/leaffish'
    )
    expect(resolveLeaffishUpdateFeedUrl('http://updates.example.com/leaffish')).toBeNull()
    expect(resolveLeaffishUpdateFeedUrl('not a URL')).toBeNull()
    expect(resolveLeaffishUpdateFeedUrl(undefined)).toBeNull()
  })
})
