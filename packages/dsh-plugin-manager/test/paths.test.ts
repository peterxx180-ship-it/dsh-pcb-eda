import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolvePaths, assertCliAvailable } from '../src/paths.ts'

test('relocated package and a different KiCad installation require no fixed drive or version', () => {
  const root = mkdtempSync(join(tmpdir(), 'manager relocated '))
  try {
    const packages = join(root, 'checkout with spaces', 'packages')
    const packageDir = join(packages, 'dsh-plugin-manager')
    const moduleFile = join(packageDir, 'lib', 'index.js')
    const runtime = join(root, 'KiCad another version', 'bin')
    mkdirSync(join(packageDir, 'lib'), { recursive: true })
    mkdirSync(runtime, { recursive: true })
    writeFileSync(moduleFile, '')
    writeFileSync(join(runtime, 'dsh-cli.cjs'), '')
    const executable = join(runtime, 'node.exe')
    const expected = { pluginsDir: packages, dshCliPath: join(runtime, 'dsh-cli.cjs') }
    assert.deepEqual(resolvePaths({}, pathToFileURL(moduleFile).href, executable), expected)
    // The profile installs the package through a junction; discover the source catalog.
    const linked = join(root, 'profile-package')
    symlinkSync(packageDir, linked, process.platform === 'win32' ? 'junction' : 'dir')
    assert.deepEqual(resolvePaths({}, pathToFileURL(join(linked, 'lib', 'index.js')).href, executable), expected)
    assert.doesNotThrow(() => assertCliAvailable(expected.dshCliPath))
    const override = join(root, 'custom-catalog')
    mkdirSync(override)
    assert.equal(resolvePaths({ pluginsDir: override }, pathToFileURL(moduleFile).href, executable).pluginsDir, override)
    assert.throws(() => resolvePaths({ pluginsDir: join(root, 'missing') }), /catalog directory/)
    assert.throws(() => resolvePaths({ pluginsDir: override, dshCliPath: 'relative.cjs' }), /must be absolute/)
    // A missing CLI does not prevent listing/toggling already registered plugins.
    const missing = resolvePaths({}, pathToFileURL(moduleFile).href, join(root, 'missing-runtime', 'node.exe'))
    assert.throws(() => assertCliAvailable(missing.dshCliPath), /bundled CLI not found/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
