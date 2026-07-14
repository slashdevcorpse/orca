import { describe, expect, it } from 'vitest'
import { buildChangedFileTree } from '../src/changed-file-tree'
import type { ChangedFileV1 } from '../src/contract'

const files: ChangedFileV1[] = [
  {
    id: 'file-z',
    file: { id: 'host-z', displayPath: 'src\\renderer\\zeta.ts' },
    status: 'modified',
    additions: 3,
    deletions: 1
  },
  {
    id: 'file-a',
    file: { id: 'host-a', displayPath: 'src/renderer/alpha.ts' },
    status: 'added',
    additions: 8,
    deletions: 0
  },
  {
    id: 'readme',
    file: { id: 'host-readme', displayPath: 'README.md' },
    status: 'modified',
    additions: 1,
    deletions: 2
  }
]

describe('changed-file tree', () => {
  it('normalizes Windows paths, groups directories, and aggregates diff totals', () => {
    const tree = buildChangedFileTree(files)
    const src = tree[0]
    expect(src.kind).toBe('directory')
    if (src.kind !== 'directory') {
      throw new Error('expected src directory')
    }
    expect(src.name).toBe('src')
    expect(src.additions).toBe(11)
    expect(src.deletions).toBe(1)
    const renderer = src.children[0]
    expect(renderer.kind).toBe('directory')
    if (renderer.kind !== 'directory') {
      throw new Error('expected renderer directory')
    }
    expect(renderer.children.map((child) => child.name)).toEqual(['alpha.ts', 'zeta.ts'])
  })

  it('sorts directories before root files', () => {
    expect(buildChangedFileTree(files).map((node) => node.name)).toEqual(['src', 'README.md'])
  })
})
