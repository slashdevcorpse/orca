import { createHash } from 'node:crypto'
import {
  APP_DISTRIBUTION,
  getAppDistributionDefinition,
  type AppDistribution
} from '../../shared/app-distribution'
import {
  isWindowsRemoteHost,
  joinRemotePath,
  remoteBasename,
  type RemoteHostPlatform
} from './ssh-remote-platform'

export const WINDOWS_ACTIVE_PIPE_MARKER_PREFIX = '.windows-active-pipe-'

export function relayEndpointForHost(
  hostPlatform: RemoteHostPlatform,
  remoteDir: string,
  sockName: string,
  appDistribution: AppDistribution = APP_DISTRIBUTION
): string {
  if (!isWindowsRemoteHost(hostPlatform)) {
    return joinRemotePath(hostPlatform, remoteDir, sockName)
  }
  const endpointHash = createHash('sha256')
    .update(`${remoteDir}\0${sockName}`)
    .digest('hex')
    .slice(0, 20)
  const pipePrefix = getAppDistributionDefinition(appDistribution).hostNamespaces.sshRelayPipePrefix
  return `\\\\.\\pipe\\${pipePrefix}-${endpointHash}`
}

export function relayHookEndpointDirForHost(
  hostPlatform: RemoteHostPlatform,
  remoteDir: string,
  sockPath: string
): string {
  return joinRemotePath(
    hostPlatform,
    remoteDir,
    'agent-hooks',
    remoteBasename(sockPath, hostPlatform)
  )
}

export function windowsRelayFallbackSocketName(sockName: string): string {
  return `${sockName}-fallback`
}

export function windowsRelayPipePathsForSocketName(
  hostPlatform: RemoteHostPlatform,
  remoteDir: string,
  sockName: string,
  appDistribution: AppDistribution = APP_DISTRIBUTION
): string[] {
  return [
    relayEndpointForHost(hostPlatform, remoteDir, sockName, appDistribution),
    relayEndpointForHost(
      hostPlatform,
      remoteDir,
      windowsRelayFallbackSocketName(sockName),
      appDistribution
    )
  ]
}

export function windowsActivePipeMarkerPath(
  hostPlatform: RemoteHostPlatform,
  remoteDir: string,
  sockName: string
): string {
  return joinRemotePath(
    hostPlatform,
    remoteDir,
    `${WINDOWS_ACTIVE_PIPE_MARKER_PREFIX}${sockName.replace(/[^a-zA-Z0-9.-]/g, '_')}`
  )
}

export function isWindowsRelayPipePath(
  value: string,
  appDistribution: AppDistribution = APP_DISTRIBUTION
): boolean {
  const pipePrefix = getAppDistributionDefinition(appDistribution).hostNamespaces.sshRelayPipePrefix
  const escapedPrefix = pipePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^\\\\\\\\[.?]\\\\pipe\\\\${escapedPrefix}-[0-9a-f]{20}$`, 'i').test(value)
}
