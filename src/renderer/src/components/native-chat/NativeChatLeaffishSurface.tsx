import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { TranscriptSurface, type ImageReferenceV1 } from '@leaffish/agent-transcript'
import '@leaffish/agent-transcript/styles.css'
import { ArrowDown, Image as ImageIcon } from 'lucide-react'
import CommentMarkdown, {
  type CommentMarkdownLinkClickHandler
} from '@/components/sidebar/CommentMarkdown'
import { translate } from '@/i18n/i18n'
import { basename } from '@/lib/path'
import { isNearBottom, shouldShowJumpToLatest } from './native-chat-autoscroll'
import { isNativeChatPastedImagePath } from './native-chat-image-paste'
import { nativeChatSessionToLeaffishDocument } from './native-chat-leaffish-document'
import type { NativeChatLiveSession } from './use-native-chat-live-session'
import { NATIVE_CHAT_STREAMING_ID } from '../../../../shared/native-chat-streaming'

type NativeChatLeaffishSurfaceProps = {
  session: NativeChatLiveSession
  isWorking: boolean
  fontScale: number
  onLinkClick?: CommentMarkdownLinkClickHandler
  allowFileUriLinks?: boolean
  onOpenFile?: (displayPath: string) => void
  failedDeliveryMessageIds?: ReadonlySet<string>
}

function geometryOf(element: HTMLElement): {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
} {
  return {
    scrollTop: element.scrollTop,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight
  }
}

function TypingIndicator(): React.JSX.Element {
  return (
    <div
      className="flex h-8 items-center gap-1.5 text-muted-foreground"
      aria-label={translate('components.native-chat.status.responding', 'Agent is responding')}
      aria-live="polite"
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/70"
          style={{ animationDelay: `${index * 160}ms` }}
        />
      ))}
    </div>
  )
}

function ImageReference({ image }: { image: ImageReferenceV1 }): React.JSX.Element {
  const source = image.label ?? image.alt ?? image.sourceId
  const label = isNativeChatPastedImagePath(image.sourceId)
    ? translate('components.native-chat.composer.pastedImageLabel', 'Pasted image')
    : basename(source)
  return (
    <div className="flex max-w-full items-center gap-1.5" title={source}>
      <ImageIcon className="size-3.5 shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  )
}

export function NativeChatLeaffishSurface({
  session,
  isWorking,
  fontScale,
  onLinkClick,
  allowFileUriLinks = false,
  onOpenFile,
  failedDeliveryMessageIds
}: NativeChatLeaffishSurfaceProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stuckToBottomRef = useRef(true)
  const prependAnchorRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null)
  const [showJump, setShowJump] = useState(false)
  const document = useMemo(
    () => nativeChatSessionToLeaffishDocument(session, isWorking, failedDeliveryMessageIds),
    [failedDeliveryMessageIds, isWorking, session]
  )
  const showTyping =
    isWorking && !session.messages.some((message) => message.id === NATIVE_CHAT_STREAMING_ID)

  const loadEarlier = useCallback(() => {
    const element = scrollRef.current
    if (element) {
      prependAnchorRef.current = {
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop
      }
    }
    session.loadEarlier()
  }, [session])

  const handleScroll = useCallback(() => {
    const element = scrollRef.current
    if (!element) {
      return
    }
    const geometry = geometryOf(element)
    const stuck = isNearBottom(geometry)
    stuckToBottomRef.current = stuck
    setShowJump(shouldShowJumpToLatest(stuck, geometry))
    if (geometry.scrollTop < 80 && session.hasMore && !session.loadingEarlier) {
      loadEarlier()
    }
  }, [loadEarlier, session.hasMore, session.loadingEarlier])

  const scrollToBottom = useCallback(() => {
    const element = scrollRef.current
    if (!element) {
      return
    }
    element.scrollTop = element.scrollHeight
    stuckToBottomRef.current = true
    setShowJump(false)
  }, [])

  useLayoutEffect(() => {
    const element = scrollRef.current
    if (!element) {
      return
    }
    if (prependAnchorRef.current) {
      const growth = element.scrollHeight - prependAnchorRef.current.scrollHeight
      element.scrollTop = prependAnchorRef.current.scrollTop + growth
      prependAnchorRef.current = null
      return
    }
    if (stuckToBottomRef.current) {
      scrollToBottom()
    }
  }, [document, scrollToBottom, showTyping])

  useEffect(() => {
    const element = scrollRef.current
    if (!element || typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(handleScroll)
    observer.observe(element)
    return () => observer.disconnect()
  }, [handleScroll])

  const renderMarkdown = useCallback(
    (markdown: string) => (
      <CommentMarkdown
        content={markdown}
        variant="document"
        className="text-sm"
        onLinkClick={onLinkClick}
        allowFileUriLinks={allowFileUriLinks}
      />
    ),
    [allowFileUriLinks, onLinkClick]
  )
  const renderImage = useCallback((image: ImageReferenceV1) => <ImageReference image={image} />, [])

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-sleek h-full overflow-y-auto px-3 pt-10 pb-4 sm:px-4"
      >
        <div className="mx-auto w-full max-w-3xl" style={{ zoom: fontScale }}>
          {session.hasMore ? (
            <div className="flex justify-center py-1">
              <button
                type="button"
                onClick={loadEarlier}
                disabled={session.loadingEarlier}
                className="rounded-md px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
              >
                {session.loadingEarlier
                  ? translate('components.native-chat.loadingEarlier', 'Loading…')
                  : translate('components.native-chat.loadEarlier', 'Load earlier messages')}
              </button>
            </div>
          ) : null}
          <TranscriptSurface
            document={document}
            preferenceNamespace="native-chat"
            renderMarkdown={renderMarkdown}
            renderImage={renderImage}
            onOpenFile={onOpenFile ? (file) => onOpenFile(file.displayPath) : undefined}
          />
          {showTyping ? <TypingIndicator /> : null}
        </div>
      </div>
      {showJump ? (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label={translate('components.native-chat.jumpToLatest', 'Jump to latest')}
          className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowDown className="size-3.5" />
          <span>{translate('components.native-chat.jumpToLatest', 'Jump to latest')}</span>
        </button>
      ) : null}
    </div>
  )
}
