import { getAppDistributionDefinition } from './app-distribution'

export function getOrcaCliCommandNameForPlatform(platform: NodeJS.Platform): string {
  const commandName = getAppDistributionDefinition().cliCommandName
  if (commandName !== 'orca') {
    return platform === 'win32' ? `${commandName}.cmd` : commandName
  }
  if (platform === 'linux') {
    return 'orca-ide'
  }
  if (platform === 'win32') {
    return 'orca.cmd'
  }
  return 'orca'
}
