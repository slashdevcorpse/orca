import type { ChangedFileV1 } from './contract'

export type ChangedFileTreeDirectory = {
  kind: 'directory'
  id: string
  name: string
  path: string
  additions: number
  deletions: number
  children: ChangedFileTreeNode[]
}

export type ChangedFileTreeFile = {
  kind: 'file'
  id: string
  name: string
  path: string
  additions: number
  deletions: number
  file: ChangedFileV1
}

export type ChangedFileTreeNode = ChangedFileTreeDirectory | ChangedFileTreeFile

type MutableDirectory = ChangedFileTreeDirectory & {
  childDirectories: Map<string, MutableDirectory>
}

function normalizedSegments(displayPath: string): string[] {
  return displayPath
    .replaceAll('\\', '/')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.')
}

function createDirectory(name: string, path: string): MutableDirectory {
  return {
    kind: 'directory',
    id: `directory:${path}`,
    name,
    path,
    additions: 0,
    deletions: 0,
    children: [],
    childDirectories: new Map()
  }
}

function finalizeDirectory(directory: MutableDirectory): ChangedFileTreeDirectory {
  const children = directory.children
    .map((child) =>
      child.kind === 'directory' ? finalizeDirectory(child as MutableDirectory) : child
    )
    .sort((left, right) => {
      if (left.kind !== right.kind) {
        return left.kind === 'directory' ? -1 : 1
      }
      return left.name.localeCompare(right.name)
    })
  const { childDirectories: _childDirectories, ...finalized } = directory
  return { ...finalized, children }
}

export function buildChangedFileTree(files: readonly ChangedFileV1[]): ChangedFileTreeNode[] {
  const root = createDirectory('', '')
  for (const file of files) {
    const segments = normalizedSegments(file.file.displayPath)
    const name = segments.at(-1) ?? file.file.displayPath
    const directorySegments = segments.slice(0, -1)
    let parent = root
    parent.additions += file.additions
    parent.deletions += file.deletions

    for (let index = 0; index < directorySegments.length; index += 1) {
      const segment = directorySegments[index]
      const path = directorySegments.slice(0, index + 1).join('/')
      let directory = parent.childDirectories.get(segment)
      if (!directory) {
        directory = createDirectory(segment, path)
        parent.childDirectories.set(segment, directory)
        parent.children.push(directory)
      }
      directory.additions += file.additions
      directory.deletions += file.deletions
      parent = directory
    }

    parent.children.push({
      kind: 'file',
      id: file.id,
      name,
      path: segments.join('/'),
      additions: file.additions,
      deletions: file.deletions,
      file
    })
  }
  return finalizeDirectory(root).children
}
