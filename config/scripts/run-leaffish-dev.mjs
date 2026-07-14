#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const isWindows = process.platform === 'win32'
// Why: recent Node releases reject direct .cmd execution on Windows, so use
// the system command processor for the distribution-aware development entrypoint.
const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm'
const args = isWindows ? ['/d', '/s', '/c', 'pnpm dev'] : ['dev']
const result = spawnSync(command, args, {
  env: {
    ...process.env,
    // Why: development must exercise the same embedded identity and isolated
    // userData namespace as the packaged Leaffish distribution.
    ORCA_DISTRIBUTION: 'leaffish'
  },
  stdio: 'inherit'
})

if (result.signal) {
  process.kill(process.pid, result.signal)
}
if (result.error) {
  throw result.error
}
process.exit(result.status ?? 1)
