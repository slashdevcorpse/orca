export type AppDistribution = 'orca' | 'leaffish'

export type AppDistributionDefinition = {
  appId: string
  cliCommandName: string
  daemonHostExecutableName: string
  hostNamespaces: {
    managedHomeDirectoryName: string
    relayRuntimeDirectoryName: string
    sshControlSocketDirectoryName: string
    sshRelayInstallDirectoryName: string
    sshRelayPipePrefix: string
    sshRelaySentinelName: string
    wslCliBridgeFileName: string
    wslCliCommandName: string
    wslCliDataDirectoryName: string
    wslLegacyCliCommandNames: readonly string[]
  }
  localDataDirectoryName: string
  name: string
  userDataDirectoryName: string
}

const DEFINITIONS: Record<AppDistribution, AppDistributionDefinition> = {
  orca: {
    appId: 'com.stablyai.orca',
    cliCommandName: 'orca',
    daemonHostExecutableName: 'orca-terminal-daemon.exe',
    hostNamespaces: {
      managedHomeDirectoryName: '.orca',
      relayRuntimeDirectoryName: '.orca-relay',
      sshControlSocketDirectoryName: 'orca-ssh',
      sshRelayInstallDirectoryName: '.orca-remote',
      sshRelayPipePrefix: 'orca-relay',
      sshRelaySentinelName: 'ORCA-RELAY',
      wslCliBridgeFileName: 'orca-wsl-bridge.ps1',
      wslCliCommandName: 'orca-ide',
      wslCliDataDirectoryName: 'orca',
      wslLegacyCliCommandNames: ['orca']
    },
    localDataDirectoryName: 'Orca',
    name: 'Orca',
    userDataDirectoryName: 'orca'
  },
  leaffish: {
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
  }
}

function getEmbeddedOrRuntimeDistribution(): string | undefined {
  const embedded = (globalThis as typeof globalThis & { ORCA_APP_DISTRIBUTION?: AppDistribution })
    .ORCA_APP_DISTRIBUTION
  if (embedded) {
    return embedded
  }
  return typeof process !== 'undefined' ? process.env.ORCA_DISTRIBUTION : undefined
}

export function resolveAppDistribution(
  value = getEmbeddedOrRuntimeDistribution()
): AppDistribution {
  return value === 'leaffish' ? 'leaffish' : 'orca'
}

export const APP_DISTRIBUTION = resolveAppDistribution()

export function getAppDistributionDefinition(
  distribution: AppDistribution = APP_DISTRIBUTION
): AppDistributionDefinition {
  return DEFINITIONS[distribution]
}

export function resolveLeaffishUpdateFeedUrl(
  value = typeof process !== 'undefined' ? process.env.LEAFFISH_UPDATE_FEED_URL : undefined
): string | null {
  if (!value) {
    return null
  }
  try {
    const url = new URL(value)
    // Why: update manifests lead to executable installers, so a fork feed must
    // be authenticated in transit rather than accepting downgradeable HTTP.
    return url.protocol === 'https:' ? url.href.replace(/\/$/, '') : null
  } catch {
    return null
  }
}
