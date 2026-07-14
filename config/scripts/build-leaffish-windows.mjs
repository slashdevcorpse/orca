#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const isWindows = process.platform === 'win32'
// Why: Node 24 rejects direct .cmd execution with EINVAL on Windows. Route
// through the system command processor while keeping POSIX builds shell-free.
const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm'
const args = isWindows ? ['/d', '/s', '/c', 'pnpm build:win'] : ['build:win']
const result = spawnSync(command, args, {
  env: {
    ...process.env,
    // Why: one flag drives both electron-vite's embedded runtime identity and
    // electron-builder's package identity, preventing mixed Orca/Leaffish builds.
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
