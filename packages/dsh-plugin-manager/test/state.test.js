import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { catalog } from '../src/state.ts'

test('lists only local bundles and preserves their profile selection', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-plugin-manager-'))
  const plugins = join(root, 'plugins')
  const profile = join(root, 'profile')
  await mkdir(join(plugins, 'sample'), { recursive: true })
  await mkdir(profile)
  await writeFile(join(plugins, 'sample', 'package.json'), JSON.stringify({ name: 'sample', dsh: { bundle: { patch: './cordis.patch.yml' } } }))
  await writeFile(join(profile, 'package.json'), JSON.stringify({ dependencies: { sample: 'file:sample' }, dsh: { profile: { bundles: ['core', 'sample'] } } }))
  assert.deepEqual((await catalog(plugins, profile)).map((row) => [row.name, row.enabled]), [['sample', true]])
  assert.equal((await catalog(plugins, profile))[0].installed, true)
})
