import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { Schematic } from '../src/schematic/builder.ts'
import { inspectLocalConnections } from '../src/schematic/local-connections.ts'
import type { FlatPoint, FlatObject } from '../src/schematic/flat.ts'

const wire = (from: FlatPoint, to: FlatPoint): FlatObject => ({ uuid: `${from}:${to}`, type: 'wire', from, to })
const pair = (name: string, from: FlatPoint, to: FlatPoint) => ({ name, from, to })
const resolve = (point: any): FlatPoint => point

test('wire paths follow explicit endpoints and bends while ignoring same-name labels', () => {
  const objects: FlatObject[] = [wire([0, 0], [5, 0]), wire([5, 0], [5, 5]), wire([5, 5], [10, 5]),
    wire([20, 0], [25, 0]), { uuid: 'label1', type: 'label', at: [0, 0], name: 'SAME' },
    { uuid: 'label2', type: 'label', at: [20, 0], name: 'SAME' }]
  const report = inspectLocalConnections(objects, [pair('direct', [0, 0], [10, 5]), pair('label island', [0, 0], [20, 0])], resolve)
  assert.equal(report.scope, 'wire-geometry-only')
  assert.equal(report.failed, 1)
  assert.equal(report.checks[0]?.name, 'label island')
  assert.equal(report.checks[0]?.code, 'LOCAL_WIRE_PATH_MISSING')
})

test('unsplit crossings and component interiors do not create direct wire paths', () => {
  const objects = [wire([0, 5], [10, 5]), wire([5, 0], [5, 10]), wire([20, 0], [22, 0]), wire([24, 0], [26, 0])]
  assert.equal(inspectLocalConnections(objects, [pair('crossing', [0, 5], [5, 0]), pair('resistor interior', [20, 0], [26, 0])], resolve).failed, 2)
})

test('floating point roundoff does not break an explicitly split branch', () => {
  const objects = [wire([0, 0], [5.08, 0]), wire([5.079999999999999, 0], [5.08, 5.08])]
  assert.equal(inspectLocalConnections(objects, [pair('branch', [0, 0], [5.08, 5.08])], resolve).failed, 0)
})

test('bounded reports preserve total failures and show failures before successful checks', () => {
  const connections = Array.from({ length: 50 }, (_, i) => pair(`success ${i}`, [0, 0], [5, 0]))
  connections.push(pair('last failure', [0, 0], [20, 0]))
  const report = inspectLocalConnections([wire([0, 0], [5, 0])], connections, resolve)
  assert.equal(report.total, 51); assert.equal(report.failed, 1)
  assert.equal(report.checks.length, 40); assert.equal(report.truncated, true)
  assert.equal(report.checks[0]?.name, 'last failure')
})

test('public API aggregates bad pins and uses sheet coordinates after a translated region', () => {
  const sch = new Schematic({ projectName: 'local', title: 'Local', paper: 'A4',
    templateDir: fileURLToPath(new URL('../skills/kicad-schematic-design/templates', import.meta.url)) })
  const region = sch.region({ name: 'circuit', description: '', origin: [50.8, 25.4], size: [50.8, 50.8] })
  region.wire([0, 0], [10.16, 0]); region.label('SAME', [10.16, 0])
  const report = sch.localConnectionsReport([
    pair('global path', region.at([0, 0]), region.at([10.16, 0])),
    { name: 'missing pin', from: { reference: 'U1', pin: '1' }, to: { reference: 'C1', pin: '1' } },
  ])
  assert.equal(report.failed, 1)
  assert.equal(report.checks[0]?.code, 'LOCAL_PIN_INVALID')
  assert.equal(report.checks[1]?.passed, true)
})
