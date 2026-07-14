import type { ReactElement } from 'react'
import type { TranscriptHostActions, TranscriptContentContext } from './component-contract'
import type { MarkdownContentV1 } from './contract'

type TranscriptContentProps = Pick<
  TranscriptHostActions,
  'renderContent' | 'renderMarkdown' | 'renderImage'
> & {
  content: MarkdownContentV1
  context: TranscriptContentContext
}

export function TranscriptContent({
  content,
  context,
  renderContent,
  renderMarkdown,
  renderImage
}: TranscriptContentProps): ReactElement {
  if (renderContent) {
    return <>{renderContent(content, context)}</>
  }
  return (
    <>
      {content.images?.length ? (
        <div className="leaffish-transcript__attachments">
          {content.images.map((image) => (
            <div className="leaffish-transcript__attachment" key={image.id}>
              {renderImage ? (
                renderImage(image, context)
              ) : (
                <span>{image.label ?? image.alt ?? 'Image'}</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
      {content.markdown ? (
        renderMarkdown ? (
          <>{renderMarkdown(content.markdown, context)}</>
        ) : (
          <div className="leaffish-transcript__plain-content">{content.markdown}</div>
        )
      ) : null}
    </>
  )
}
