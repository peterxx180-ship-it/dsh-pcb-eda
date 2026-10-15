/** Loader entry fields used by the installed KiCad host. */
export interface LoaderEntry {
  options: { id: string; name: string }
  disabled: boolean
  update(options: { disabled: boolean }): Promise<unknown>
}
/** Iteration supplied by the installed Cordis loader. */
export interface Loader { entries(): Iterable<LoaderEntry> }
