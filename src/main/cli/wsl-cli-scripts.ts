import {
  getAppDistributionDefinition,
  type AppDistributionDefinition
} from '../../shared/app-distribution'

function managedMarker(distribution: AppDistributionDefinition): string {
  return `# ${distribution.name} managed WSL CLI launcher`
}

function bridgeManagedMarker(distribution: AppDistributionDefinition): string {
  return `# ${distribution.name} managed WSL CLI PowerShell bridge`
}

function defaultBridgePath(distribution: AppDistributionDefinition): string {
  const { wslCliBridgeFileName, wslCliDataDirectoryName } = distribution.hostNamespaces
  return `\${XDG_DATA_HOME:-$HOME/.local/share}/${wslCliDataDirectoryName}/${wslCliBridgeFileName}`
}

export function buildWslLauncher(
  windowsLauncherPath: string,
  bridgePath?: string,
  distribution = getAppDistributionDefinition()
): string {
  const encodedTarget = Buffer.from(windowsLauncherPath, 'utf8').toString('base64')
  const resolvedBridgePath = bridgePath ?? defaultBridgePath(distribution)
  return `#!/usr/bin/env bash
set -euo pipefail
${managedMarker(distribution)}
# ORCA_WIN_LAUNCHER_B64=${encodedTarget}
ORCA_WIN_LAUNCHER=${quoteShell(windowsLauncherPath)}
ORCA_BRIDGE_PS1=${quoteShell(resolvedBridgePath)}
if command -v powershell.exe >/dev/null 2>&1; then
  ORCA_POWERSHELL=powershell.exe
elif [ -x /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ]; then
  ORCA_POWERSHELL=/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe
else
  echo "${distribution.name} WSL CLI requires Windows interop and could not find powershell.exe." >&2
  exit 1
fi
ORCA_BRIDGE_PS1_WIN=$(wslpath -w "$ORCA_BRIDGE_PS1")
exec "$ORCA_POWERSHELL" -NoProfile -ExecutionPolicy Bypass -File "$ORCA_BRIDGE_PS1_WIN" "$ORCA_WIN_LAUNCHER" "$@"
`
}

export function buildWslBridgeScript(distribution = getAppDistributionDefinition()): string {
  return `${bridgeManagedMarker(distribution)}
param(
  [Parameter(Mandatory=$true)]
  [string]$OrcaLauncher,

  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$ForwardArgs
)

try {
  & $OrcaLauncher @ForwardArgs
  if (-not $?) {
    exit 1
  }
  if ($null -eq $LASTEXITCODE) {
    exit 0
  }
  exit $LASTEXITCODE
} catch {
  Write-Error $_
  exit 1
}
`
}

export function getBridgePathFromCommandPath(
  commandPath: string,
  distribution = getAppDistributionDefinition()
): string {
  const { wslCliBridgeFileName, wslCliDataDirectoryName } = distribution.hostNamespaces
  // Why: the launcher and bridge must share one distribution-owned namespace
  // so Orca and Leaffish can be installed in the same WSL distro.
  const dataRoot = commandPath.replace(/\/\.local\/bin\/[^/]+$/, '/.local/share')
  return `${dataRoot}/${wslCliDataDirectoryName}/${wslCliBridgeFileName}`
}

export function buildSafeReplaceGuard(path: string, managedMarker: string): string {
  const quotedPath = quoteShell(path)
  const quotedMarker = quoteShell(managedMarker)
  return [
    `if [ -L ${quotedPath} ]; then`,
    '  echo "__ORCA_CONFLICT__"',
    '  exit 23',
    `elif [ -e ${quotedPath} ] && { [ ! -f ${quotedPath} ] || ! grep -Fq ${quotedMarker} ${quotedPath}; }; then`,
    '  echo "__ORCA_CONFLICT__"',
    '  exit 23',
    'fi'
  ].join('\n')
}

export function buildSafeRemoveCommand(
  commandPath: string,
  distribution = getAppDistributionDefinition()
): string {
  const bridgePath = getBridgePathFromCommandPath(commandPath, distribution)
  return [
    'set -euo pipefail',
    buildSafeReplaceGuard(commandPath, managedMarker(distribution)),
    buildSafeReplaceGuard(bridgePath, bridgeManagedMarker(distribution)),
    `rm -f ${quoteShell(commandPath)} ${quoteShell(bridgePath)}`
  ].join('\n')
}

export function parseManagedLauncherTarget(content: string): string | null {
  const encoded = content.match(/^# ORCA_WIN_LAUNCHER_B64=([A-Za-z0-9+/=]+)$/m)?.[1]
  if (encoded) {
    try {
      return Buffer.from(encoded, 'base64').toString('utf8')
    } catch {
      return null
    }
  }

  const legacyTarget = content.match(/^ORCA_WIN_LAUNCHER='((?:[^']|'"'"')*)'$/m)?.[1]
  return legacyTarget ? legacyTarget.replaceAll(`'"'"'`, "'") : null
}

export function getPosixDirname(path: string): string {
  return path.slice(0, path.lastIndexOf('/')) || '/'
}

export function getWslLauncherMarker(distribution = getAppDistributionDefinition()): string {
  return managedMarker(distribution)
}

export function getWslBridgeMarker(distribution = getAppDistributionDefinition()): string {
  return bridgeManagedMarker(distribution)
}

export function quoteShell(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`
}
