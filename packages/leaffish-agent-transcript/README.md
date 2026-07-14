# `@leaffish/agent-transcript`

Independent React presentation for Orca-compatible coding-agent transcripts. The package owns
turn folding, tool lifecycle rows, reasoning disclosure, and changed-file presentation. It does
not read terminals, files, Git state, runtime sockets, or Electron APIs.

## Host contract

The host adapts its transcript into `TranscriptDocumentV1` and mounts `TranscriptSurface`.
`schemaVersion: 1` is checked at the package boundary. A turn keeps `finalResponse` separate from
foldable `activity`, so collapsed commands never hide the agent's final explanation.

The host should provide:

- `renderMarkdown` (or `renderContent`) using Orca's sanitized Markdown renderer and link routing.
- `renderImage` to resolve opaque image references on the correct local, WSL, or SSH host.
- `onOpenFile` and `onOpenDiff` to validate opaque file references before opening them.
- A `preferenceNamespace` containing the Orca profile and surface identity.

Import `@leaffish/agent-transcript/styles.css` in the host entrypoint. The stylesheet uses Orca's
canonical CSS variables rather than owning a theme.

```tsx
<TranscriptSurface
  document={document}
  preferenceNamespace={`orca:${profileId}:native-chat`}
  renderMarkdown={(markdown, context) => (
    <HostMarkdown markdown={markdown} turnId={context.turnId} />
  )}
  renderImage={(image) => <HostImage sourceId={image.sourceId} alt={image.alt} />}
  onOpenFile={(file) => host.openFile(file.id)}
  onOpenDiff={(file) => host.openDiff(file.id)}
/>
```
