/** Persisted enablement of the installed HQ Edge loader entries. */
import type { ToggleResult } from './state.ts'
/** Loader entry fields used by the installed KiCad host. */
export interface LoaderEntry {
  options: { id: string; name: string }
  disabled: boolean
  update(options: { disabled: boolean }): Promise<unknown>
}
/** Iteration supplied by the installed Cordis loader. */
export interface Loader { entries(): Iterable<LoaderEntry> }
/** Catalog identity and display name for an installed plugin. */
export interface Builtin { name: string; id: string; label: string }
/** Built-in row returned to the settings page. */
export interface BuiltinRow extends Builtin { enabled: boolean; available: boolean }
import { randomUUID } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'

export const BUILTINS = [
  { name: '@huaqiu/dsh-eda-host', id: 'huaqiu-dsh-eda-host', label: 'EDA Host 桥接' },
  { name: '@huaqiu/dsh-kicad', id: 'huaqiu-dsh-kicad', label: 'KiCad IPC' },
  { name: '@huaqiu/dsh-tool-part-search', id: 'huaqiu-tool-part-search', label: '元件检索（HQSCH）' },
  { name: '@huaqiu/dsh-tool-symbol-footprint', id: 'huaqiu-tool-symbol-footprint', label: '符号与封装生成' },
  { name: '@huaqiu/dsh-tool-schematic-gen', id: 'huaqiu-tool-schematic-gen', label: '原理图 / 系统图生成' },
  { name: '@huaqiu/dsh-tool-pcb-viewer', id: 'dsh-tool-pcb-viewer', label: 'PCB 可视化' },
  { name: '@hqedge/dsh-erc', id: 'hq-erc', label: 'ERC / BOM' },
]

async function readDisabled(filename: string): Promise<Set<string>> {
  let text
  try {
    text = await readFile(filename, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') return new Set()
    throw error
  }
  const data = JSON.parse(text) as { disabled: unknown }
  if (!Array.isArray(data.disabled) || data.disabled.some((name) =>
    typeof name !== 'string' || !BUILTINS.some((plugin) => plugin.name === name))) {
    throw new Error('Invalid built-in plugin state')
  }
  return new Set(data.disabled)
}

async function writeDisabled(filename: string, disabled: Set<string>): Promise<void> {
  const temp = `${filename}.${randomUUID()}.tmp`
  await writeFile(temp, `${JSON.stringify({ disabled: [...disabled].sort() }, null, 2)}\n`, { flag: 'wx' })
  await rename(temp, filename)
}

export class BuiltinController {
  private operations: Promise<unknown> = Promise.resolve()

  constructor(private loader: Loader, private statePath: string) {
  }

  entry(plugin: Builtin): LoaderEntry {
    const matches = [...this.loader.entries()].filter((entry) =>
      entry.options.id === plugin.id && entry.options.name === plugin.name)
    if (matches.length !== 1) throw new Error(`Built-in plugin is unavailable: ${plugin.name}`)
    return matches[0]!
  }

  serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.operations.then(operation)
    this.operations = result.catch((_error: unknown) => { /* Each caller receives the rejection; subsequent operations remain runnable. */ })
    return result
  }

  async list(): Promise<BuiltinRow[]> {
    await this.operations
    const disabled = await readDisabled(this.statePath)
    return BUILTINS.map((plugin) => {
      const available = [...this.loader.entries()].some((entry) =>
        entry.options.id === plugin.id && entry.options.name === plugin.name)
      return { ...plugin, enabled: !disabled.has(plugin.name), available }
    })
  }

  reconcile(): Promise<void> {
    return this.serialize(async () => {
      const disabled = await readDisabled(this.statePath)
      for (const plugin of BUILTINS) {
        if (!disabled.has(plugin.name)) continue
        const entry = this.entry(plugin)
        if (!entry.disabled) await entry.update({ disabled: true })
      }
    })
  }

  setEnabled(name: unknown, enabled: unknown): Promise<ToggleResult> {
    return this.serialize(async () => {
      if (typeof name !== 'string' || typeof enabled !== 'boolean') throw new Error('Invalid request')
      const plugin = BUILTINS.find((item) => item.name === name)
      if (!plugin) throw new Error('Unknown built-in plugin')
      const entry = this.entry(plugin)
      const disabled = await readDisabled(this.statePath)
      const before = !disabled.has(name)
      if (before === enabled && entry.disabled === !enabled) return { changed: false, restartRequired: false }
      const previousRuntime = entry.disabled
      await entry.update({ disabled: !enabled })
      if (enabled) disabled.delete(name)
      else disabled.add(name)
      try {
        await writeDisabled(this.statePath, disabled)
      } catch (error) {
        await entry.update({ disabled: previousRuntime })
        throw error
      }
      return { changed: before !== enabled, restartRequired: false }
    })
  }
}
