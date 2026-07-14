import type { ReactNode } from 'react'
import type {
  FileReferenceV1,
  ImageReferenceV1,
  MarkdownContentV1,
  TranscriptDocumentV1
} from './contract'
import type { PreferenceStorage } from './preferences'

export type TranscriptContentContext = {
  turnId: string
  role: 'user' | 'assistant' | 'reasoning'
}

export type TranscriptHostActions = {
  /** Orca keeps ownership of sanitized Markdown and file-link routing. */
  renderMarkdown?: (markdown: string, context: TranscriptContentContext) => ReactNode
  /** Images stay opaque until the host resolves local, WSL, or SSH references. */
  renderImage?: (image: ImageReferenceV1, context: TranscriptContentContext) => ReactNode
  renderContent?: (content: MarkdownContentV1, context: TranscriptContentContext) => ReactNode
  onOpenFile?: (file: FileReferenceV1) => void
  onOpenDiff?: (file: FileReferenceV1) => void
}

export type TranscriptSurfaceProps = TranscriptHostActions & {
  document: TranscriptDocumentV1
  preferenceNamespace: string
  preferenceStorage?: PreferenceStorage
  className?: string
  emptyState?: ReactNode
}
