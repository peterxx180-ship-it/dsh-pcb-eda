import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { BUILTINS, BuiltinController } from '../src/builtins.ts'

test('built-in switch changes the loader entry and restores saved choices on startup', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kicad-builtins-'))
  try {
    const plugin = BUILTINS[2]
    const options = { id: plugin.id, name: plugin.name, disabled: false }
    const entry = {
      options,
      get disabled() { return this.options.disabled },
      async update(next) { Object.assign(this.options, next) },
    }
    const loader = { *entries() { yield entry } }
    const statePath = join(directory, 'builtins.json')
    const controller = new BuiltinController(loader, statePath)
    assert.equal((await controller.setEnabled(plugin.name, false)).changed, true)
    assert.equal(entry.disabled, true)
    assert.deepEqual(JSON.parse(await readFile(statePath, 'utf8')).disabled, [plugin.name])
    entry.options.disabled = false
    await new BuiltinController(loader, statePath).reconcile()
    assert.equal(entry.disabled, true)
    assert.equal((await controller.setEnabled(plugin.name, true)).changed, true)
    assert.equal(entry.disabled, false)
    assert.deepEqual(JSON.parse(await readFile(statePath, 'utf8')).disabled, [])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
