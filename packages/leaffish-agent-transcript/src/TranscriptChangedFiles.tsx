import { useEffect, useId, useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import { ChevronRight, Folder } from 'lucide-react'
import { buildChangedFileTree, type ChangedFileTreeNode } from './changed-file-tree'
import type { TranscriptHostActions } from './component-contract'
import type { ChangedFileV1 } from './contract'
import { InlineDiff } from './InlineDiff'

const STATUS_LABEL: Record<ChangedFileV1['status'], string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  copied: 'C',
  untracked: 'U'
}

function collectExpandableIds(nodes: readonly ChangedFileTreeNode[]): string[] {
  const ids: string[] = []
  for (const node of nodes) {
    if (node.kind === 'directory') {
      ids.push(node.id, ...collectExpandableIds(node.children))
    } else if (node.file.diff?.length) {
      ids.push(node.id)
    }
  }
  return ids
}

function DiffStats({
  additions,
  deletions
}: {
  additions: number
  deletions: number
}): ReactElement {
  return (
    <span
      className="leaffish-file-tree__stats"
      aria-label={`${additions} additions, ${deletions} deletions`}
    >
      <span data-kind="addition">+{additions}</span>
      <span data-kind="deletion">−{deletions}</span>
    </span>
  )
}

function FileNode({
  node,
  depth,
  expandedIds,
  setNodeExpanded,
  hostActions
}: {
  node: Extract<ChangedFileTreeNode, { kind: 'file' }>
  depth: number
  expandedIds: ReadonlySet<string>
  setNodeExpanded: (id: string, expanded: boolean) => void
  hostActions: TranscriptHostActions
}): ReactElement {
  const detailId = useId()
  const hasDiff = Boolean(node.file.diff?.length)
  const expanded = hasDiff && expandedIds.has(node.id)
  const pathLabel =
    node.file.previousDisplayPath && node.file.status === 'renamed'
      ? `${node.file.previousDisplayPath} → ${node.path}`
      : node.path

  return (
    <div className="leaffish-file-tree__file" data-status={node.file.status}>
      <div
        className="leaffish-file-tree__row"
        style={{ '--leaffish-tree-depth': depth } as CSSProperties}
      >
        <button
          type="button"
          className="leaffish-file-tree__disclosure leaffish-disclosure"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} changes for ${node.path}`}
          aria-expanded={hasDiff ? expanded : undefined}
          aria-controls={hasDiff ? detailId : undefined}
          disabled={!hasDiff}
          onClick={() => hasDiff && setNodeExpanded(node.id, !expanded)}
        >
          <ChevronRight
            className="leaffish-disclosure__chevron"
            data-expanded={expanded}
            data-hidden={!hasDiff}
            aria-hidden="true"
          />
        </button>
        <span className="leaffish-file-tree__status" aria-label={node.file.status}>
          {STATUS_LABEL[node.file.status]}
        </span>
        {hostActions.onOpenFile ? (
          <button
            type="button"
            className="leaffish-file-tree__path"
            title={pathLabel}
            onClick={() => hostActions.onOpenFile?.(node.file.file)}
          >
            {node.name}
          </button>
        ) : (
          <span className="leaffish-file-tree__path" title={pathLabel}>
            {node.name}
          </span>
        )}
        <DiffStats additions={node.additions} deletions={node.deletions} />
      </div>
      {hasDiff && expanded ? (
        <div className="leaffish-file-tree__diff" id={detailId}>
          <InlineDiff lines={node.file.diff ?? []} />
          {hostActions.onOpenDiff ? (
            <button
              type="button"
              className="leaffish-file-tree__full-diff"
              onClick={() => hostActions.onOpenDiff?.(node.file.file)}
            >
              View full diff
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function DirectoryNode({
  node,
  depth,
  expandedIds,
  setNodeExpanded,
  hostActions
}: {
  node: Extract<ChangedFileTreeNode, { kind: 'directory' }>
  depth: number
  expandedIds: ReadonlySet<string>
  setNodeExpanded: (id: string, expanded: boolean) => void
  hostActions: TranscriptHostActions
}): ReactElement {
  const contentId = useId()
  const expanded = expandedIds.has(node.id)
  return (
    <div className="leaffish-file-tree__directory">
      <button
        type="button"
        className="leaffish-file-tree__row leaffish-file-tree__directory-row leaffish-disclosure"
        style={{ '--leaffish-tree-depth': depth } as CSSProperties}
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setNodeExpanded(node.id, !expanded)}
      >
        <ChevronRight
          className="leaffish-disclosure__chevron"
          data-expanded={expanded}
          aria-hidden="true"
        />
        <Folder className="leaffish-file-tree__folder" aria-hidden="true" />
        <span className="leaffish-file-tree__path">{node.name}</span>
        <DiffStats additions={node.additions} deletions={node.deletions} />
      </button>
      {expanded ? (
        <div id={contentId}>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              setNodeExpanded={setNodeExpanded}
              hostActions={hostActions}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function TreeNode({
  node,
  depth,
  expandedIds,
  setNodeExpanded,
  hostActions
}: {
  node: ChangedFileTreeNode
  depth: number
  expandedIds: ReadonlySet<string>
  setNodeExpanded: (id: string, expanded: boolean) => void
  hostActions: TranscriptHostActions
}): ReactElement {
  return node.kind === 'directory' ? (
    <DirectoryNode
      node={node}
      depth={depth}
      expandedIds={expandedIds}
      setNodeExpanded={setNodeExpanded}
      hostActions={hostActions}
    />
  ) : (
    <FileNode
      node={node}
      depth={depth}
      expandedIds={expandedIds}
      setNodeExpanded={setNodeExpanded}
      hostActions={hostActions}
    />
  )
}

export function TranscriptChangedFiles({
  files,
  defaultExpanded,
  defaultDiffsExpanded,
  onExpandedPreferenceChange,
  onDiffsPreferenceChange,
  hostActions
}: {
  files: readonly ChangedFileV1[]
  defaultExpanded: boolean
  defaultDiffsExpanded: boolean
  onExpandedPreferenceChange: (expanded: boolean) => void
  onDiffsPreferenceChange: (expanded: boolean) => void
  hostActions: TranscriptHostActions
}): ReactElement | null {
  const tree = useMemo(() => buildChangedFileTree(files), [files])
  const expandableIds = useMemo(() => collectExpandableIds(tree), [tree])
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(defaultDiffsExpanded ? expandableIds : [])
  )
  const contentId = useId()
  const additions = files.reduce((total, file) => total + file.additions, 0)
  const deletions = files.reduce((total, file) => total + file.deletions, 0)

  useEffect(() => setExpanded(defaultExpanded), [defaultExpanded])
  useEffect(() => {
    setExpandedIds(new Set(defaultDiffsExpanded ? expandableIds : []))
  }, [defaultDiffsExpanded, expandableIds])

  if (files.length === 0) {
    return null
  }

  const setNodeExpanded = (id: string, shouldExpand: boolean): void => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (shouldExpand) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  const setAllExpanded = (shouldExpand: boolean): void => {
    setExpandedIds(new Set(shouldExpand ? expandableIds : []))
    onDiffsPreferenceChange(shouldExpand)
  }

  return (
    <section className="leaffish-changes">
      <button
        type="button"
        className="leaffish-changes__summary leaffish-disclosure"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => {
          const next = !expanded
          setExpanded(next)
          onExpandedPreferenceChange(next)
        }}
      >
        <ChevronRight
          className="leaffish-disclosure__chevron"
          data-expanded={expanded}
          aria-hidden="true"
        />
        <span>
          {files.length} changed {files.length === 1 ? 'file' : 'files'}
        </span>
        <DiffStats additions={additions} deletions={deletions} />
      </button>
      {expanded ? (
        <div className="leaffish-changes__content" id={contentId}>
          <div className="leaffish-changes__actions" aria-label="Changed file display controls">
            <button type="button" onClick={() => setAllExpanded(true)}>
              Expand all
            </button>
            <button type="button" onClick={() => setAllExpanded(false)}>
              Collapse all
            </button>
          </div>
          <div className="leaffish-file-tree">
            {tree.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                depth={0}
                expandedIds={expandedIds}
                setNodeExpanded={setNodeExpanded}
                hostActions={hostActions}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
