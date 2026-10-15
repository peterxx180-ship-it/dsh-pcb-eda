import { existsSync, realpathSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Optional overrides; normally the linked package and running Node locate both paths. */
export interface Config { pluginsDir?: string; dshCliPath?: string }

export function resolvePaths(config: Config = {}, moduleUrl = import.meta.url, executable = process.execPath): { pluginsDir: string; dshCliPath: string } {
  // Resolve junctions/symlinks before finding the sibling workspace packages.
  const pluginsDir = config.pluginsDir ?? resolve(dirname(realpathSync(fileURLToPath(moduleUrl))), '..', '..')
  if (!isAbsolute(pluginsDir) || !existsSync(pluginsDir) || !statSync(pluginsDir).isDirectory()) {
    throw new Error(`dsh-plugin-manager: plugin catalog directory does not exist or is not absolute: ${pluginsDir}`)
  }
  const dshCliPath = config.dshCliPath ?? join(dirname(executable), 'dsh-cli.cjs')
  if (!isAbsolute(dshCliPath)) throw new Error('dsh-plugin-manager: dshCliPath must be absolute')
  return { pluginsDir, dshCliPath }
}

/** CLI availability is needed only when registering an uninstalled plugin. */
export function assertCliAvailable(filename: string): void {
  if (!existsSync(filename) || !statSync(filename).isFile()) {
    throw new Error(`dsh-plugin-manager: KiCad bundled CLI not found: ${filename}. Set dshCliPath to this installation's bin/dsh-cli.cjs.`)
  }
}
