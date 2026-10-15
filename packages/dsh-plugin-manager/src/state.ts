/** Directory-based plugin catalog. Switch mutations belong to PluginController. */
import { readFile, readdir, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'

export const MANAGER_NAME = '@local/dsh-plugin-manager'

function inside(parent: string, child: string): boolean {
  const rel = relative(parent, child)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
}

async function readJson(file: string): Promise<Manifest> {
  return JSON.parse(await readFile(file, 'utf8'))
}

/** List local bundles contained in the catalog directory.
 * @param pluginsDir - catalog directory.
 * @param profileDir - active DSH profile directory.
 * @returns sorted plugin rows including persisted selection.
 */
export async function catalog(pluginsDir: string, profileDir: string): Promise<LocalPlugin[]> {
  const root = await realpath(pluginsDir)
  const profile = await readJson(join(profileDir, 'package.json'))
  const selected = new Set(profile.dsh?.profile?.bundles ?? [])
  const dependencies = profile.dependencies ?? {}
  const entries = await readdir(root, { withFileTypes: true })
  const plugins: LocalPlugin[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const folder = join(root, entry.name)
    const target = await realpath(folder)
    if (!inside(root, target)) continue
    let pkg
    try {
      pkg = await readJson(join(target, 'package.json'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') continue
      throw error
    }
    if (typeof pkg.name !== 'string' || !pkg.dsh?.bundle?.patch) continue
    plugins.push({
      name: pkg.name,
      folder: entry.name,
      description: typeof pkg.description === 'string' ? pkg.description : '',
      installed: Object.hasOwn(dependencies, pkg.name),
      enabled: selected.has(pkg.name),
      protected: pkg.name === MANAGER_NAME,
    })
  }
  plugins.sort((a, b) => a.name.localeCompare(b.name))
  return plugins
}

/** Package manifest fields read from local JSON files. */
interface Manifest {
  name?: string
  description?: string
  dependencies?: Record<string, string>
  dsh?: { bundle?: { patch?: string }; profile?: { bundles?: string[] } }
}
/** User plugin displayed by the manager. */
export interface LocalPlugin {
  name: string
  folder: string
  description: string
  installed: boolean
  enabled: boolean
  protected: boolean
}
