import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {Schematic} from '../src/schematic/builder.ts'
import {ConnectedSchematic, SchematicProject} from '../src/schematic/design.ts'
import {children, parse, value} from '../src/schematic/sexpr.ts'
import {listFlatObjects} from '../src/schematic/flat.ts'
import {parseNetlist} from '../src/schematic/verify.ts'

const templateDir = fileURLToPath(new URL('../skills/kicad-schematic-design/templates', import.meta.url))
const options = {projectName: 'declaration', title: 'Declaration', paper: 'A4' as const, templateDir}
function fixture(run: (root: string, libraryPath: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'dsh-design-'))
  const library = join(root, 'parts.kicad_sym')
  writeFileSync(library, `(kicad_symbol_lib (version 20211014) (generator test)
    (symbol "Pair" (property "Reference" "R" (at 0 0 0) (effects (font (size 1 1))))
    (property "Value" "Pair" (at 0 0 0) (effects (font (size 1 1))))
    (symbol "Pair_0_1" (rectangle (start -2.54 1.27) (end 2.54 -1.27) (stroke (width 0.15) (type default)) (fill (type none))))
    (symbol "Pair_1_1"
      (pin passive line (at -5.08 0 0) (length 2.54) (name "IN" (effects (font (size 1 1)))) (number "1" (effects (font (size 1 1)))))
      (pin passive line (at 5.08 0 180) (length 2.54) (name "OUT" (effects (font (size 1 1)))) (number "2" (effects (font (size 1 1))))))))`)
  try { run(root, library) } finally { rmSync(root, {recursive: true, force: true}) }
}

test('declarations reject omitted/unknown pins before mutation; explicit NC/manual are distinct', () => fixture((_root, libraryPath) => {
  const s = new ConnectedSchematic(options)
  const base = {libraryPath, libId: 'Parts:Pair', reference: 'R1', at: [25.4, 25.4] as [number, number]}
  assert.throws(() => s.addComponent({...base, connections: {'1': 'IN'}}), /unassigned=\[2\]/)
  assert.throws(() => s.addComponent({...base, connections: {'1': 'IN', '2': null, '3': 'EXTRA'}}), /unknown=\[3\]/)
  assert.throws(() => s.addComponent({...base, connections: {'1': {net: 'IN', length: 0}, '2': null}}), /positive length/)
  assert.equal(s.pinCatalog().length, 0)
  s.addComponent({...base, connections: {'1': {manual: true}, '2': null}})
  s.wire(s.pin('R1', '1'), [10.16, 25.4]); s.label('MANUAL', [10.16, 25.4])
  const objects = listFlatObjects(s.render().schematic)
  assert.equal(objects.filter(o => o.type === 'no_connect').length, 1)
  assert.equal(objects.filter(o => o.type === 'wire').length, 1)
  const plan = s.connectionPlan(); plan[0]!.net = 'CHANGED'
  assert.equal(s.connectionPlan()[0]!.net, null)
}))

test('rotation/mirror drive outward leads; repeated renders do not add connections', () => fixture((_root, libraryPath) => {
  for (const [angle, mirror, direction] of [[0, undefined, 'left'], [90, undefined, 'down'], [0, 'y', 'right'], [90, 'x', 'up']] as const) {
    const s = new ConnectedSchematic(options)
    s.addComponent({libraryPath, libId: 'Parts:Pair', reference: 'R1', at: [50.8, 50.8], angle, mirror, connections: {'1': 'INPUT', '2': null}})
    assert.equal(s.connectionPlan()[0]!.direction, direction)
    const first = listFlatObjects(s.render().schematic), second = listFlatObjects(s.render().schematic)
    assert.equal(first.filter(o => o.type === 'wire').length, 1)
    assert.equal(second.filter(o => o.type === 'wire').length, 1)
    const wire = first.find(o => o.type === 'wire')!
    assert.deepEqual(wire.from, s.pin('R1', '1'))
    const delta = [wire.to![0] - wire.from![0], wire.to![1] - wire.from![1]]
    assert.deepEqual(delta.map(v => Math.round(v * 100) / 100), {left: [-5.08, 0], right: [5.08, 0], up: [0, -5.08], down: [0, 5.08]}[direction])
  }
}))

test('stable keyed instances survive layout/reference changes and preserve DNP/custom fields', () => fixture((_root, libraryPath) => {
  const build = (reference: string, x: number) => {
    const s = new Schematic(options)
    s.addSymbol({libraryPath, libId: 'Parts:Pair', reference, key: 'input.filter', at: [x, 25.4], dnp: true, properties: {MPN: 'A"B', Notes: '可选\n滤波器'}})
    assert.throws(() => s.addSymbol({libraryPath, libId: 'Parts:Pair', reference: 'R99', key: 'input.filter', at: [60, 25]}), /unique/)
    return s.render().schematic
  }
  const first = build('R1', 25.4), second = build('R2', 50.8)
  assert.equal(listFlatObjects(first)[0]!.uuid, listFlatObjects(second)[0]!.uuid)
  assert.equal(listFlatObjects(first)[0]!.dnp, true)
  const symbol = children(parse(first), 'symbol')[0]!
  const fields = children(symbol, 'property')
  assert.equal(value(fields.find(p => value(p) === 'MPN')!, 2), 'A"B')
  assert.equal(value(fields.find(p => value(p) === 'Notes')!, 2), '可选\n滤波器')
  const s = new Schematic(options)
  assert.throws(() => s.addSymbol({libraryPath, libId: 'Parts:Pair', reference: 'R1', at: [25, 25], properties: {Reference: 'BAD'}}), /custom property/)
  assert.equal(s.pinCatalog().length, 0)
}))

test('project wrapper validates ports before writes; exports final-reference intent and real cross-sheet nets', () => fixture((root, libraryPath) => {
  const p = new SchematicProject(options)
  for (const name of ['input', 'output']) {
    const sheet = p.sheet(name, {title: name, connections: {BUS: 'SIGNAL'}})
    sheet.addComponent({libraryPath, libId: 'Parts:Pair', reference: 'R8', at: [25.4, 25.4], dnp: true, properties: {MPN: 'TEST'}, connections: {'1': {manual: true}, '2': null}})
    sheet.hierarchicalLabel('BUS', sheet.pin('R8', '1'))
  }
  const out = join(root, 'project'), saved = p.save(out)
  assert.equal(saved.sheets.length, 2)
  const manifest = JSON.parse(readFileSync(join(out, 'connection-plan.json'), 'utf8'))
  assert.equal(manifest.sheets[0].connections[0].reference, saved.sheets[0]!.references.R8)
  assert.notEqual(saved.sheets[0]!.references.R8, saved.sheets[1]!.references.R8)
  assert.throws(() => p.save(out), /EEXIST/)
  const bad = new SchematicProject(options)
  const sheet = bad.sheet('bad', {title: 'bad', connections: {MISSING: 'SIGNAL'}})
  sheet.addComponent({libraryPath, libId: 'Parts:Pair', reference: 'R1', at: [25.4, 25.4], connections: {'1': 'IN', '2': null}})
  assert.throws(() => bad.save(join(root, 'bad')), /preflight/)
  assert.equal(existsSync(join(root, 'bad')), false)
  const cli = process.env.KICAD_CLI_PATH ?? 'D:\\kicad\\10.0.0\\bin\\kicad-cli.exe'
  if (existsSync(cli)) {
    const netlist = join(root, 'actual.net')
    execFileSync(cli, ['sch', 'export', 'netlist', '--format', 'kicadsexpr', '-o', netlist, saved.rootPath], {stdio: 'pipe'})
    const nets = parseNetlist(readFileSync(netlist, 'utf8'))
    const bus = nets.find(net => net.nodes.filter(node => node.pin === '1').length === 2)
    assert.ok(bus, 'both child pins must share an actual KiCad net')
    for (const child of saved.sheets) {
      const text = readFileSync(join(out, child.filename), 'utf8')
      assert.ok(listFlatObjects(text)[0]!.dnp)
      assert.match(text, /\(property "MPN" "TEST"/)
    }
  }
}))
