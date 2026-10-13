import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply, type Config, inject } from '../src/modules/index.ts'

const config: Config = {
  search: { apiBaseUrl: 'https://gen.eda.cn', requestTimeoutMs: 30000, maxResults: 10, maxResponseBytes: 1000000 },
  download: { apiBaseUrl: 'https://www.eda.cn', requestTimeoutMs: 30000, maxDetailBytes: 2000000,
    maxZipBytes: 20000000, maxSchematicBytes: 10000000, maxProjectBytes: 10000000, maxArchiveEntries: 512 },
}

test('canonical entry registers both catalog searches and the KiCad download adapter', () => {
  const names: string[] = []
  const ctx = {
    hqEdge: { context: { getTargetHost: () => 'kicad' } },
    tools: { register: (tool: { name: string }) => { names.push(tool.name); return () => {} } },
    effect: (callback: () => unknown) => callback(),
  }
  apply(ctx as never, config)
  assert.deepEqual(names, ['download_eda_module_schematic', 'eda_module_rag_search', 'eda_module_category_search', 'eda_module_precise_search'])
  assert.deepEqual(inject, ['tools', 'fs', 'sandboxPolicy', 'hqEdge'])
})

test('canonical entry rejects another EDA host before registration', () => {
  assert.throws(() => apply({ hqEdge: { context: { getTargetHost: () => 'other' } } } as never, config), /requires a KiCad/)
})
