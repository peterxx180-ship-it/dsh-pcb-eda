/** Save a downloaded schematic through DSH's workspace-scoped filesystem service. */
import { isAbsolute, join } from 'node:path'
import type { FileSystem } from '@deepseek-ai/dsh-fs'
import { downloadSchematic, type DownloadOptions } from './download.ts'

export type WorkspaceFileSystem = Pick<FileSystem, 'resolve' | 'contains' | 'stat' | 'readText' | 'writeText'>
type WritePolicy = Parameters<FileSystem['writeText']>[4]

/** Tool result: the local file and its verified remote source. */
export interface SavedSchematic {
  moduleId: string
  moduleName: string
  schematicPath: string
  sourceUrl: string
  archiveEntry: string
  archiveEntries: string[]
  sha256: string
  bytes: number
  status: 'created' | 'existing'
  originalProjectPath: string | null
  originalProjectArchiveEntry: string | null
  originalProjectSha256: string | null
  originalProjectBytes: number | null
  originalProjectStatus: 'created' | 'existing' | 'absent'
}

/** Keep the target inside an existing session directory; never overwrite different content. */
export async function downloadIntoWorkspace(
  moduleId: string,
  targetDir: string | undefined,
  workspaceRoot: string,
  options: DownloadOptions,
  fs: WorkspaceFileSystem,
  policy: WritePolicy,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<SavedSchematic> {
  const workspace = await fs.resolve(workspaceRoot, { signal })
  const directory = await fs.resolve(targetDir ?? workspaceRoot, { cwd: workspaceRoot, signal })
  if (!fs.contains(workspace, directory) || !isAbsolute(directory.displayPath)) {
    throw new Error('targetDir must be an existing local directory inside the agent workspace')
  }
  const info = await fs.stat(directory, signal)
  if (info?.type !== 'directory') {
    throw new Error('targetDir must be an existing local directory inside the agent workspace')
  }

  const source = await downloadSchematic(moduleId, options, signal, fetcher)
  const target = await fs.resolve(join(directory.displayPath, `HQ_EDA_${moduleId}.kicad_sch`), { signal })
  if (!fs.contains(directory, target)) throw new Error('schematic target escaped targetDir')
  const existing = await fs.stat(target, signal)
  if (existing !== undefined) {
    if (existing.type !== 'file' || await fs.readText(target, signal) !== source.text) {
      throw new Error(`schematic path already exists with different content: ${target.displayPath}`)
    }
  }
  const projectTarget = source.project === undefined ? undefined
    : await fs.resolve(join(directory.displayPath, `HQ_EDA_${moduleId}.source.kicad_pro`), { signal })
  if (projectTarget !== undefined && !fs.contains(directory, projectTarget)) {
    throw new Error('project target escaped targetDir')
  }
  const existingProject = projectTarget === undefined ? undefined : await fs.stat(projectTarget, signal)
  if (source.project !== undefined && projectTarget !== undefined && existingProject !== undefined
    && (existingProject.type !== 'file' || await fs.readText(projectTarget, signal) !== source.project.text)) {
    throw new Error(`project path already exists with different content: ${projectTarget.displayPath}`)
  }
  signal.throwIfAborted()
  if (existing === undefined) await fs.writeText(target, source.text, { kind: 'createIfAbsent' }, signal, policy)
  if (source.project !== undefined && projectTarget !== undefined && existingProject === undefined) {
    await fs.writeText(projectTarget, source.project.text, { kind: 'createIfAbsent' }, signal, policy)
  }
  return {
    moduleId,
    moduleName: source.moduleName,
    schematicPath: target.displayPath,
    sourceUrl: source.sourceUrl,
    archiveEntry: source.archiveEntry,
    archiveEntries: source.archiveEntries,
    sha256: source.sha256,
    bytes: source.bytes,
    status: existing === undefined ? 'created' : 'existing',
    originalProjectPath: projectTarget?.displayPath ?? null,
    originalProjectArchiveEntry: source.project?.archiveEntry ?? null,
    originalProjectSha256: source.project?.sha256 ?? null,
    originalProjectBytes: source.project?.bytes ?? null,
    originalProjectStatus: source.project === undefined ? 'absent'
      : existingProject === undefined ? 'created' : 'existing',
  }
}
