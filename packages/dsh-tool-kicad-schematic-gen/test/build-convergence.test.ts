import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Schematic } from '../src/schematic/builder.ts'
import { inspectFrameLayout } from '../src/schematic/layout-report.ts'

const templateDir = fileURLToPath(new URL('../skills/kicad-schematic-design/templates', import.meta.url))
const build = () => new Schematic({ templateDir, projectName: 'convergence', title: 'Convergence', paper: 'A4' })
const frame = (name: string, start: [number, number], end: [number, number]) => ({ name, description: '', start, end })

test('frame diagnostics distinguish overlaps, touching frames and sheet overflow without moving frames', () => {
  const frames = [frame('source', [10, 10], [100, 100]), frame('new', [90, 20], [120, 90]),
    frame('touching', [120, 20], [130, 90]), frame('overflow', [290, 200], [310, 220])]
  const before = JSON.stringify(frames)
  const report = inspectFrameLayout(frames, [297, 210])
  assert.equal(report.total, 2)
  assert.deepEqual(report.issues.map(i => [i.code, i.frame, i.otherFrame]),
    [['FRAME_OVERLAP', 'source', 'new'], ['FRAME_OUTSIDE_PAGE', 'overflow', undefined]])
  assert.equal(JSON.stringify(frames), before)
})

test('layout report is available before wiring or required power conversion', () => {
  const sch = new Schematic({ templateDir, projectName: 'plan', title: 'Plan', paper: 'A4', requiredPowerSymbols: { GND: 'power:GND' } })
  sch.frame(frame('source', [10, 10], [100, 100]))
  sch.region({ name: 'new', description: '', origin: [90, 20], size: [30, 40] })
  assert.equal(sch.layoutReport().issues[0]?.otherFrame, 'new')
})

test('malformed local endpoints name the failed operation before serializing partial wires', () => {
  const sch = build(), region = sch.region({ name: 'local', description: '', origin: [50.8, 25.4], size: [50.8, 50.8] })
  assert.throws(() => region.wire([0, 0], [NaN, 0]), /region.wire.to.*finite millimetre values/)
  assert.throws(() => region.wire([0, 0], 5 as never), /region.wire.to.*expected \[x, y\]/)
  assert.throws(() => region.wire([0, 0], [5, 0], [[undefined, 0] as never]), /region.wire.via\[0\]/)
  assert.throws(() => sch.wire(null as never, [0, 0]), /schematic endpoint/)
})

test('source auto-frame and new region are inspected together; local pin positions survive relocation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'convergence-'))
  try {
    const library = join(root, 'symbol.kicad_sym')
    await writeFile(library, `(kicad_symbol_lib (version 20211014) (generator test)
      (symbol "R" (property "Reference" "R" (at 0 0 0)) (property "Value" "R" (at 0 0 0))
        (symbol "R_0_1" (rectangle (start -1 -1) (end 1 1) (stroke (width 0.15) (type default)) (fill (type none))))
        (symbol "R_1_1" (pin passive line (at 0 2.54 270) (length 1.27) (name "~") (number "1")))))`)
    const spec = { libraryPath: library, libId: 'test:R', reference: 'R1', at: [10.16, 10.16] as [number, number] }
    const source = build()
    source.addSymbol({ ...spec, at: [50.8, 50.8] })
    const path = source.save(join(root, 'source')).schematicPath
    const sch = build(), imported = sch.importModule({ sourcePath: path, name: 'core', offset: [0, 0], nets: {} })
    sch.frame({ name: 'core', description: '', autoBounds: true, objectUuids: imported.objectUuids })
    const region = sch.region({ name: 'new', description: '', origin: [40.64, 40.64], size: [50.8, 50.8] })
    region.addSymbol({ ...spec, reference: 'R2' })
    const global = sch.pin('R2', '1'), local = region.pin('R2', '1')
    assert.deepEqual(region.at(local), global)
    assert.equal(sch.layoutReport().issues.some(i => i.code === 'FRAME_OVERLAP'), true)
    assert.equal(sch.save(join(root, 'new')).layout.total, sch.layoutReport().total)
  } finally { await rm(root, { recursive: true, force: true }) }
})
