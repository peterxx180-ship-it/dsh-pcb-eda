import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { catalog, setEnabled } from '../src/state.ts'

test('lists local bundles and persists an installed plugin toggle', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-plugin-manager-'))
  const plugins = join(root, 'plugins')
  const profile = join(root, 'profile')
  await mkdir(join(plugins, 'sample'), { recursive: true })
  await mkdir(profile)
  await writeFile(join(plugins, 'sample', 'package.json'), JSON.stringify({ name: 'sample', dsh: { bundle: { patch: './cordis.patch.yml' } } }))
  await writeFile(join(profile, 'package.json'), JSON.stringify({ dependencies: { sample: 'file:sample' }, dsh: { profile: { bundles: ['core', 'sample'] } } }))
  assert.deepEqual((await catalog(plugins, profile)).map((row) => [row.name, row.enabled]), [['sample', true]])
  assert.deepEqual(await setEnabled(plugins, profile, 'sample', false), { changed: true, restartRequired: true })
  const result = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'))
  assert.deepEqual(result.dsh.profile.bundles, ['core'])
  assert.equal(result.dependencies.sample, 'file:sample')
  await assert.rejects(setEnabled(plugins, profile, 'missing', true), /not in the local catalog/)
})
