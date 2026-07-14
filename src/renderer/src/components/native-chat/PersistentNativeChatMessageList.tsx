import { Component, type ErrorInfo, type ReactNode } from 'react'
import type { ComponentProps } from 'react'
import { APP_DISTRIBUTION } from '../../../../shared/app-distribution'
import { NativeChatLeaffishSurface } from './NativeChatLeaffishSurface'
import { NativeChatMessageList } from './NativeChatMessageList'

type UpstreamListProps = ComponentProps<typeof NativeChatMessageList>

type PersistentNativeChatMessageListProps = UpstreamListProps & {
  onOpenFile?: (displayPath: string) => void
}

class TranscriptBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Leaffish transcript surface failed; using Orca message list', error, info)
  }

  render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Keeps the upstream list as a safe compatibility path when Orca's contract drifts. */
export function PersistentNativeChatMessageList({
  onOpenFile,
  ...upstreamProps
}: PersistentNativeChatMessageListProps): React.JSX.Element {
  const fallback = <NativeChatMessageList {...upstreamProps} />
  if (APP_DISTRIBUTION !== 'leaffish') {
    return fallback
  }
  return (
    <TranscriptBoundary
      key={`${upstreamProps.session.agent}:${upstreamProps.session.sessionId ?? 'pending'}`}
      fallback={fallback}
    >
      <NativeChatLeaffishSurface
        session={upstreamProps.session}
        isWorking={upstreamProps.isWorking}
        fontScale={upstreamProps.fontScale}
        onLinkClick={upstreamProps.onLinkClick}
        allowFileUriLinks={upstreamProps.allowFileUriLinks}
        onOpenFile={onOpenFile}
        failedDeliveryMessageIds={upstreamProps.failedDeliveryMessageIds}
      />
    </TranscriptBoundary>
  )
}
