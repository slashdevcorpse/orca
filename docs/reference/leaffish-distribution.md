# Leaffish distribution

Leaffish is a separately identified Orca distribution that owns the durable transcript UI while
continuing to consume Orca's agent, terminal, workspace, Git, WSL, and SSH implementations.

## Why the customization survives Orca updates

Most of the feature lives in `packages/leaffish-agent-transcript`. That package accepts the
versioned `TranscriptDocumentV1` contract and has no Electron, terminal, filesystem, Git, WSL, or
SSH dependencies. Orca-specific event shapes are converted by
`native-chat-leaffish-document.ts`; `PersistentNativeChatMessageList.tsx` is the narrow renderer
switch. If Orca changes its internal transcript model, the adapter is the primary compatibility
point and the package can remain unchanged.

The renderer switch is enabled only when the embedded distribution is `leaffish`. A runtime error
in the Leaffish surface is caught and falls back to Orca's upstream `NativeChatMessageList`. The
official Orca build therefore keeps its current UI and behavior.

Git still owns persistence across upstream updates: keep these files on a Leaffish branch or fork
and merge or rebase new Orca releases into it. Upstream cannot silently erase committed Leaffish
files, although a change to a shared integration point can require a normal merge conflict or an
adapter update.

## User-visible behavior

- Completed command activity starts collapsed.
- An active turn exposes the newest tool event and counts earlier hidden events.
- Assistant progress notes and reasoning can be disclosed independently.
- The final assistant response remains visible outside collapsed activity.
- File-writing tool calls produce a changed-file tree with addition/deletion totals and collapsible
  inline diffs.
- Transcript display preferences use a schema-versioned Leaffish local-storage namespace.

Orca remains responsible for sanitized Markdown, file-link resolution, remote runtime identity,
pagination, auto-scroll, and message delivery state. This keeps local, WSL, and SSH file actions on
the host where Orca already knows how to route them.

## Side-by-side identity

Leaffish uses its own application ID, process name, user/session data, daemon and CLI names,
single-instance lock, updater cache, WSL command and bridge, SSH relay install directory, SSH
control sockets, relay pipes, hook data, and managed remote home. It can therefore be installed
beside Orca without sharing mutable runtime state.

Existing `ORCA_*` environment and wire fields are intentionally retained where they are protocol
names rather than storage namespaces. Renaming those fields would fork the protocol without
providing additional isolation.

## Development and Windows packaging

Install dependencies and run the distribution-aware development build:

```powershell
pnpm install
pnpm dev:leaffish
```

Build the Windows installer:

```powershell
pnpm build:win:leaffish
```

Outputs are written to:

- `dist/leaffish/leaffish-windows-setup.exe`
- `dist/leaffish/win-unpacked/Leaffish.exe`

Leaffish auto-update is disabled unless an independent HTTPS feed is supplied at build time:

```powershell
$env:LEAFFISH_UPDATE_FEED_URL = 'https://updates.example.com/leaffish'
pnpm build:win:leaffish
```

The installer is unsigned unless the normal Electron Builder signing credentials are configured.

## Bringing in a new Orca release

Use a dedicated fork with an `upstream` remote pointing at the Orca repository. The exact branch
names can differ, but the update loop is:

```powershell
git fetch upstream
git switch leaffish
git rebase upstream/main
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test:leaffish
pnpm test
pnpm build:win:leaffish
```

Resolve conflicts without replacing the Leaffish branch wholesale. Review these boundaries first:

1. `NativeChatView.tsx` and `PersistentNativeChatMessageList.tsx` for the renderer switch.
2. `native-chat-leaffish-document.ts` and native-chat types for transcript contract drift.
3. `app-distribution.ts`, Electron build configuration, WSL installation, and SSH relay namespaces
   for new mutable Orca state that also needs a Leaffish namespace.
4. Provider transcript decoders when Orca changes tool-call or tool-result correlation.
5. `pi-status-extension-bridge.ts` when generated Pi/OMP status behavior changes; bump its bridge
   revision so newer compatible source replaces the older shared bridge once.

The acceptance gate is: the focused Leaffish tests, full typecheck and lint, an official Orca build
that still selects the upstream list, and a fresh Leaffish Windows package with only Leaffish CLI
artifacts and no updater metadata unless a feed was explicitly configured.
