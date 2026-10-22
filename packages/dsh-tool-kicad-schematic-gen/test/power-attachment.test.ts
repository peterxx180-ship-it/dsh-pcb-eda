import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { attachPowerAnchors } from '../src/schematic/power-attachment.ts'
import { Schematic } from '../src/schematic/builder.ts'
import { listFlatObjects } from '../src/schematic/flat.ts'
import { parseAnalysisNetlist } from '../src/schematic/module-analysis.ts'

const wire = (uuid: string, a: string, b: string) => `(wire (pts (xy ${a}) (xy ${b})) (stroke (width 0.15) (type default)) (uuid "${uuid}"))`
test('conversion splits every selected interior anchor, preserves style/first UUID and tracks new frame members', () => {
  const original = wire('original', '40 20', '10 20')
  const unrelated = wire('unrelated', '50 30', '70 30')
  const output = attachPowerAnchors([original, unrelated], [{ uuid: 'label1', at: [20, 20] }, { uuid: 'label2', at: [30, 20] }])
  const source = `(kicad_sch (version 20250114) (uuid "root") (lib_symbols) ${output.graphics.join('\n')})`
  const objects = listFlatObjects(source)
  assert.equal(objects.filter(o => o.type === 'wire').length, 4)
  assert.equal(objects.filter(o => o.type === 'junction').length, 2)
  assert.deepEqual(objects.find(o => o.uuid === 'original')?.from, [40, 20])
  assert.deepEqual(objects.find(o => o.uuid === 'original')?.to, [30, 20])
  assert.ok(output.graphics.includes(unrelated))
  assert.equal(output.groups.get('original')?.length, 2)
  assert.equal(output.groups.get('label1')?.length, 1)
  assert.equal(output.graphics.filter(g => g.startsWith('(wire')).every(g => g.includes('(width 0.15)')), true)
})

test('endpoint conversion does not add tails/dots; existing junction is not duplicated', () => {
  const w = wire('w', '10 20', '40 20')
  assert.deepEqual(attachPowerAnchors([w], [{ uuid: 'end', at: [10, 20] }]).graphics, [w])
  const dot = '(junction (at 20 20) (diameter 0) (uuid "dot"))'
  const output = attachPowerAnchors([w, dot], [{ uuid: 'a', at: [20, 20] }, { uuid: 'b', at: [20, 20] }])
  assert.equal(output.graphics.filter(g => g.startsWith('(junction')).length, 1)
  assert.equal(output.graphics.filter(g => g.startsWith('(wire')).length, 2)
})

test('an undotted crossing requires an explicit connection choice, not a silent short', () => {
  const graphics = [wire('h', '10 20', '40 20'), wire('v', '20 10', '20 30')]
  assert.throws(() => attachPowerAnchors(graphics, [{ uuid: 'label', at: [20, 20] }]), /POWER_LABEL_AMBIGUOUS/)
  assert.equal(graphics.length, 2)
})

test('real KiCad connects stationary and moved power pins converted from on-wire labels',
  { skip: !process.env.KICAD_CLI_PATH }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'power-attachment-'))
  try {
    const library = join(root, 'test.kicad_sym')
    const font = '(effects (font (size 1.27 1.27)))'
    await writeFile(library, `(kicad_symbol_lib (version 20211014) (generator kicad_symbol_editor)
      (symbol "Demo" (property "Reference" "U" (at 0 0 0) ${font})
        (symbol "Demo_1_1" (pin passive line (at 0 0 0) (length 2.54) (name "IN" ${font}) (number "1" ${font}))))
      (symbol "GND" (power) (property "Reference" "#PWR" (at 0 0 0) ${font})
        (property "Value" "GND" (at 0 -2 0) ${font})
        (symbol "GND_1_1" (pin power_in line (at 0 0 0) (length 0) hide (name "GND" ${font}) (number "1" ${font}))))
    )`)
    for (const moved of [false, true]) {
      const sch = new Schematic({ templateDir: fileURLToPath(new URL('../skills/kicad-schematic-design/templates', import.meta.url)),
        projectName: moved ? 'moved' : 'stationary', title: 'Power attachment', paper: 'A4', requiredPowerSymbols: { GND: 'test:GND' } })
      sch.addSymbol({ libraryPath: library, libId: 'test:Demo', reference: 'U1', at: [40.64, 40.64] })
      sch.wire([40.64, 40.64], [20.32, 40.64])
      const label = sch.label('GND', [30.48, 40.64])
      sch.frame({ name: 'core', description: '', autoBounds: true })
      sch.replacePowerLabels({ libraryPath: library, nets: { GND: 'test:GND' },
        placements: moved ? { [label]: { at: [30.48, 50.8] } } : undefined })
      const objects = listFlatObjects(sch.render().schematic)
      assert.ok(objects.some(o => o.type === 'junction' && o.at?.[0] === 30.48))
      const saved = sch.save(join(root, moved ? 'moved' : 'stationary')), netlist = join(root, `${moved}.net`)
      const run = spawnSync(process.env.KICAD_CLI_PATH!, ['sch', 'export', 'netlist', '--format', 'kicadsexpr', '-o', netlist, saved.schematicPath], { encoding: 'utf8' })
      assert.equal(run.status, 0, run.stderr)
      const nets = parseAnalysisNetlist(await readFile(netlist, 'utf8')).nets
      assert.ok(nets.find(n => n.name === 'GND')?.nodes.some(n => n.reference === 'U1' && n.pin === '1'), JSON.stringify(nets))
    }
  } finally { await rm(root, { recursive: true, force: true }) }
})
