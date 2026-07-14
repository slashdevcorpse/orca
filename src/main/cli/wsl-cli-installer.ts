/* eslint-disable max-lines -- Why: WSL CLI status/install/remove share one state machine;
   splitting the installer would separate conflict checks from the operations they guard. */
import { execFile } from 'node:child_process'
import type { CliInstallStatus } from '../../shared/cli-install-types'
import {
  APP_DISTRIBUTION,
  getAppDistributionDefinition,
  type AppDistribution,
  type AppDistributionDefinition
} from '../../shared/app-distribution'
import { getDefaultWslDistro } from '../wsl'
import { CliInstaller } from './cli-installer'
import {
  buildSafeRemoveCommand,
  buildSafeReplaceGuard,
  buildWslBridgeScript,
  buildWslLauncher,
  getBridgePathFromCommandPath,
  getPosixDirname,
  getWslBridgeMarker,
  getWslLauncherMarker,
  parseManagedLauncherTarget,
  quoteShell
} from './wsl-cli-scripts'

const WSL_COMMAND_TIMEOUT_MS = 10_000

function normalizeManagedScriptContent(content: string): string {
  return content.replace(/\n+$/u, '\n')
}

function managedScriptMatches(content: string, expected: string, managed: boolean): boolean {
  return content === expected || (managed && normalizeManagedScriptContent(content) === expected)
}

type WslCliInstallerOptions = {
  appDistribution?: AppDistribution
  platform?: NodeJS.Platform
  distro?: string | null
  hostInstaller?: Pick<CliInstaller, 'getStatus'>
  wslRunner?: (distro: string, command: string) => Promise<string>
}

export class WslCliInstaller {
  private readonly distribution: AppDistributionDefinition
  private readonly platform: NodeJS.Platform
  private readonly distro: string | null
  private readonly hostInstaller: Pick<CliInstaller, 'getStatus'>
  private readonly wslRunner: (distro: string, command: string) => Promise<string>

  constructor(options: WslCliInstallerOptions = {}) {
    this.distribution = getAppDistributionDefinition(options.appDistribution ?? APP_DISTRIBUTION)
    this.platform = options.platform ?? process.platform
    this.distro = options.distro === undefined ? getDefaultWslDistro() : options.distro
    this.hostInstaller =
      options.hostInstaller ?? new CliInstaller({ appDistribution: options.appDistribution })
    this.wslRunner = options.wslRunner ?? runWslCommand
  }

  async getStatus(): Promise<CliInstallStatus> {
    const ready = await this.resolveReadyState()
    if ('status' in ready) {
      return ready.status
    }

    const content = await this.readCommandFile(ready.distro, ready.commandPath)
    if (content === null) {
      return this.buildStatus({
        distro: ready.distro,
        commandPath: ready.commandPath,
        launcherPath: ready.launcherPath,
        state: 'not_installed',
        currentTarget: null,
        pathConfigured: ready.pathConfigured,
        detail: `Register ${ready.commandPath} to use ${this.distribution.name} from WSL.`
      })
    }

    if (content === 'not_file') {
      return this.buildStatus({
        distro: ready.distro,
        commandPath: ready.commandPath,
        launcherPath: ready.launcherPath,
        state: 'conflict',
        currentTarget: null,
        pathConfigured: ready.pathConfigured,
        detail: `${ready.commandPath} exists but is not a ${this.distribution.name} launcher script.`
      })
    }

    const expected = buildWslLauncher(ready.launcherPath, ready.bridgePath, this.distribution)
    const managed = content.includes(getWslLauncherMarker(this.distribution))
    const currentTarget = managed ? parseManagedLauncherTarget(content) : null
    if (managedScriptMatches(content, expected, managed)) {
      const bridgeContent = await this.readCommandFile(ready.distro, ready.bridgePath)
      const expectedBridge = buildWslBridgeScript(this.distribution)
      const bridgeManaged =
        typeof bridgeContent === 'string' &&
        bridgeContent.includes(getWslBridgeMarker(this.distribution))
      if (
        typeof bridgeContent === 'string' &&
        managedScriptMatches(bridgeContent, expectedBridge, bridgeManaged)
      ) {
        return this.buildStatus({
          distro: ready.distro,
          commandPath: ready.commandPath,
          launcherPath: ready.launcherPath,
          state: 'installed',
          currentTarget,
          pathConfigured: ready.pathConfigured,
          detail: `Registered in ${ready.distro} at ${ready.commandPath}.`
        })
      }

      return this.buildStatus({
        distro: ready.distro,
        commandPath: ready.commandPath,
        launcherPath: ready.launcherPath,
        state: bridgeContent === null || bridgeManaged ? 'stale' : 'conflict',
        currentTarget,
        pathConfigured: ready.pathConfigured,
        detail:
          bridgeContent === null || bridgeManaged
            ? `${ready.commandPath} is missing its PowerShell bridge.`
            : `${ready.bridgePath} exists but is not managed by ${this.distribution.name}.`
      })
    }

    return this.buildStatus({
      distro: ready.distro,
      commandPath: ready.commandPath,
      launcherPath: ready.launcherPath,
      state: managed ? 'stale' : 'conflict',
      currentTarget,
      pathConfigured: ready.pathConfigured,
      detail: managed
        ? `${ready.commandPath} points to a different ${this.distribution.name} launcher.`
        : `${ready.commandPath} exists but is not managed by ${this.distribution.name}.`
    })
  }

  async install(): Promise<CliInstallStatus> {
    const status = await this.getStatus()
    if (!status.supported || !status.commandPath || !status.launcherPath) {
      throw new Error(status.detail ?? 'WSL CLI registration is unavailable.')
    }
    if (status.state === 'conflict') {
      throw new Error(
        `Refusing to replace non-${this.distribution.name} command at ${status.commandPath}.`
      )
    }

    const commandPath = status.commandPath
    const bridgePath = getBridgePathFromCommandPath(commandPath, this.distribution)
    const managedMarker = getWslLauncherMarker(this.distribution)
    const bridgeManagedMarker = getWslBridgeMarker(this.distribution)
    const legacyRemovalLines = this.distribution.hostNamespaces.wslLegacyCliCommandNames.flatMap(
      (commandName, index) => {
        const variableName = index === 0 ? 'legacy_command_path' : `legacy_command_path_${index}`
        return [
          `${variableName}=${quoteShell(`${getPosixDirname(commandPath)}/${commandName}`)}`,
          `if [ -f "$${variableName}" ] && grep -Fq ${quoteShell(managedMarker)} "$${variableName}"; then rm -f "$${variableName}"; fi`
        ]
      }
    )

    await this.run(
      this.distro as string,
      [
        'set -euo pipefail',
        `mkdir -p ${quoteShell(status.pathDirectory as string)}`,
        `mkdir -p ${quoteShell(getPosixDirname(bridgePath))}`,
        `command_tmp=${quoteShell(`${commandPath}.tmp`)}.$$`,
        `bridge_path=${quoteShell(bridgePath)}`,
        'bridge_tmp="${bridge_path}.tmp.$$"',
        'cleanup() { rm -f "$command_tmp" "$bridge_tmp"; }',
        'trap cleanup EXIT',
        buildSafeReplaceGuard(commandPath, managedMarker),
        buildSafeReplaceGuard(bridgePath, bridgeManagedMarker),
        `cat > "$command_tmp" <<'ORCA_WSL_CLI'`,
        buildWslLauncher(status.launcherPath, bridgePath, this.distribution),
        'ORCA_WSL_CLI',
        `cat > "$bridge_tmp" <<'ORCA_WSL_BRIDGE'`,
        buildWslBridgeScript(this.distribution),
        'ORCA_WSL_BRIDGE',
        'chmod 755 "$command_tmp"',
        'chmod 644 "$bridge_tmp"',
        buildSafeReplaceGuard(commandPath, managedMarker),
        buildSafeReplaceGuard(bridgePath, bridgeManagedMarker),
        // Why: the command was renamed to avoid GNOME Orca; remove only the
        // old Orca-managed WSL wrapper so unmanaged `orca` commands survive.
        ...legacyRemovalLines,
        `mv -f "$bridge_tmp" ${quoteShell(bridgePath)}`,
        `mv -f "$command_tmp" ${quoteShell(commandPath)}`,
        'trap - EXIT'
      ].join('\n')
    )
    return this.getStatus()
  }

  async remove(): Promise<CliInstallStatus> {
    const status = await this.getStatus()
    if (!status.supported || !status.commandPath) {
      return status
    }
    if (status.state === 'not_installed') {
      return status
    }
    if (status.state === 'conflict') {
      throw new Error(
        `Refusing to remove non-${this.distribution.name} command at ${status.commandPath}.`
      )
    }

    await this.run(
      this.distro as string,
      buildSafeRemoveCommand(status.commandPath, this.distribution)
    )
    return this.getStatus()
  }

  private async resolveReadyState(): Promise<
    | { status: CliInstallStatus }
    | {
        distro: string
        commandPath: string
        bridgePath: string
        launcherPath: string
        pathConfigured: boolean
      }
  > {
    if (this.platform !== 'win32') {
      return {
        status: this.unsupported(
          'platform_not_supported',
          'WSL CLI registration is only available on Windows.'
        )
      }
    }
    if (!this.distro) {
      return {
        status: this.unsupported('platform_not_supported', 'No WSL distribution is available.')
      }
    }

    const hostStatus = await this.hostInstaller.getStatus()
    if (!hostStatus.launcherPath) {
      return {
        status: this.unsupported(
          hostStatus.unsupportedReason ?? 'launcher_missing',
          hostStatus.detail ?? `The Windows ${this.distribution.name} CLI launcher is missing.`
        )
      }
    }

    const home = (await this.run(this.distro, 'printf %s "$HOME"')).trim()
    if (!home.startsWith('/')) {
      return {
        status: this.unsupported('launcher_missing', 'Unable to resolve the WSL home directory.')
      }
    }

    const interopReady =
      (
        await this.run(
          this.distro,
          '{ command -v powershell.exe >/dev/null 2>&1 || [ -x /mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe ]; } && command -v wslpath >/dev/null 2>&1 && printf yes || printf no'
        )
      ).trim() === 'yes'
    if (!interopReady) {
      return {
        status: this.unsupported(
          'launcher_missing',
          `WSL Windows interop is unavailable; ${this.distribution.name} cannot launch the Windows CLI from WSL.`
        )
      }
    }

    const pathDirectory = `${home}/.local/bin`
    // Why: the policy keeps Orca's GNOME-safe rename while giving forks their
    // own command, so the distributions can coexist in one WSL home.
    const commandPath = `${pathDirectory}/${this.distribution.hostNamespaces.wslCliCommandName}`
    const pathConfigured =
      (
        await this.run(
          this.distro,
          `case ":$PATH:" in *:${quoteShell(pathDirectory)}:*) printf yes ;; *) printf no ;; esac`
        )
      ).trim() === 'yes'

    return {
      distro: this.distro,
      commandPath,
      bridgePath: getBridgePathFromCommandPath(commandPath, this.distribution),
      launcherPath: hostStatus.launcherPath,
      pathConfigured
    }
  }

  private async readCommandFile(
    distro: string,
    commandPath: string
  ): Promise<string | 'not_file' | null> {
    const output = await this.run(
      distro,
      [
        `if [ -L ${quoteShell(commandPath)} ]; then`,
        '  printf __ORCA_NOT_FILE__',
        `elif [ ! -e ${quoteShell(commandPath)} ]; then`,
        '  printf __ORCA_MISSING__',
        `elif [ ! -f ${quoteShell(commandPath)} ]; then`,
        '  printf __ORCA_NOT_FILE__',
        'else',
        `  cat ${quoteShell(commandPath)}`,
        'fi'
      ].join('\n')
    )
    if (output === '__ORCA_MISSING__') {
      return null
    }
    if (output === '__ORCA_NOT_FILE__') {
      return 'not_file'
    }
    return output
  }

  private buildStatus(args: {
    distro: string
    commandPath: string
    launcherPath: string
    state: CliInstallStatus['state']
    currentTarget: string | null
    pathConfigured: boolean
    detail: string
  }): CliInstallStatus {
    return {
      platform: 'linux',
      commandName: this.distribution.hostNamespaces.wslCliCommandName,
      commandPath: args.commandPath,
      pathDirectory: getPosixDirname(args.commandPath),
      pathConfigured: args.pathConfigured,
      launcherPath: args.launcherPath,
      installMethod: 'wrapper',
      supported: true,
      state: args.state,
      currentTarget: args.currentTarget,
      unsupportedReason: null,
      detail:
        args.state === 'installed' && !args.pathConfigured
          ? `${args.commandPath} is registered, but ${getPosixDirname(args.commandPath)} is not on PATH in ${args.distro}.`
          : args.detail
    }
  }

  private unsupported(
    unsupportedReason: NonNullable<CliInstallStatus['unsupportedReason']>,
    detail: string
  ): CliInstallStatus {
    return {
      platform: 'linux',
      commandName: this.distribution.hostNamespaces.wslCliCommandName,
      commandPath: null,
      pathDirectory: null,
      pathConfigured: false,
      launcherPath: null,
      installMethod: null,
      supported: false,
      state: 'unsupported',
      currentTarget: null,
      unsupportedReason,
      detail
    }
  }

  private async run(distro: string, command: string): Promise<string> {
    return this.wslRunner(distro, command)
  }
}

async function runWslCommand(distro: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let child: ReturnType<typeof execFile> | null = null
    let settled = false

    const finish = (error: Error | null, stdout = ''): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timeout)
      if (error) {
        reject(error)
        return
      }
      resolve(stdout)
    }

    // Why: WSL CLI status/install/remove backs Settings UI; a wedged wsl.exe
    // process must not leave the command registration flow pending forever.
    const timeout = setTimeout(() => {
      child?.kill()
      finish(new Error(`WSL command timed out after ${WSL_COMMAND_TIMEOUT_MS}ms.`))
    }, WSL_COMMAND_TIMEOUT_MS)

    try {
      child = execFile(
        'wsl.exe',
        ['-d', distro, '--', 'bash', '-lc', buildEncodedWslBashCommand(command)],
        {
          encoding: 'utf8',
          timeout: WSL_COMMAND_TIMEOUT_MS
        },
        (error, stdout) => {
          finish(error ?? null, stdout)
        }
      )
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)))
    }
  })
}

function buildEncodedWslBashCommand(command: string): string {
  // Why: raw multiline heredocs can be flattened while crossing wsl.exe's
  // Windows command-line boundary. Send one shell-safe line and decode inside WSL.
  const encoded = Buffer.from(command, 'utf8').toString('base64')
  return `set -o pipefail; printf %s ${quoteShell(encoded)} | base64 -d | bash`
}

export const _internals = {
  buildEncodedWslBashCommand,
  buildWslBridgeScript,
  buildWslLauncher,
  getBridgePathFromCommandPath
}
