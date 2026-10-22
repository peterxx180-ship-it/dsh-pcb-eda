/** Preserve electrical attachment when an on-wire label becomes a power-symbol pin/branch. */
import { randomUUID } from 'node:crypto'
import { parse, children, value, applyEdits, quote } from './sexpr.ts'
import type { FlatPoint } from './flat.ts'

const EPS = 1e-6
const same = (a: FlatPoint, b: FlatPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]) < EPS
const readAt = (graphic: string): FlatPoint | undefined => {
  const at = children(parse(graphic), 'at')[0]
  return at ? [Number(value(at, 1)), Number(value(at, 2))] : undefined
}

export function attachPowerAnchors(graphics: string[], anchors: Array<{ uuid: string; at: FlatPoint }>) {
  const groups = new Map<string, string[]>()
  const junctions = graphics.filter(g => parse(g).head === 'junction').map(readAt).filter((p): p is FlatPoint => !!p)
  const cutsAt = new Map<string, Set<number>>()
  const segments = graphics.flatMap(graphic => {
    const form = parse(graphic)
    if (form.head !== 'wire') return []
    const pts = children(form, 'pts')[0]!, xy = children(pts, 'xy')
    const a: FlatPoint = [Number(value(xy[0]!, 1)), Number(value(xy[0]!, 2))]
    const b: FlatPoint = [Number(value(xy[1]!, 1)), Number(value(xy[1]!, 2))]
    return [{ graphic, form, pts, a, b }]
  })
  const inside = (p: FlatPoint, a: FlatPoint, b: FlatPoint) => {
    if (same(p, a) || same(p, b)) return false
    return Math.abs(a[1] - b[1]) < EPS && Math.abs(p[1] - a[1]) < EPS && p[0] > Math.min(a[0], b[0]) && p[0] < Math.max(a[0], b[0])
      || Math.abs(a[0] - b[0]) < EPS && Math.abs(p[0] - a[0]) < EPS && p[1] > Math.min(a[1], b[1]) && p[1] < Math.max(a[1], b[1])
  }
  for (const anchor of anchors) {
    const hits = segments.filter(s => inside(anchor.at, s.a, s.b))
    // A crossing without a dot has no unambiguous source wire. Do not silently join it.
    if (hits.some(s => Math.abs(s.a[0] - s.b[0]) < EPS)
      && hits.some(s => Math.abs(s.a[1] - s.b[1]) < EPS)
      && !junctions.some(p => same(p, anchor.at))) {
      throw new Error(`POWER_LABEL_AMBIGUOUS: ${anchor.uuid} at ${anchor.at.join(',')} lies on crossing wires without a junction; choose the intended connection explicitly`)
    }
  }
  const replacements = new Map<string, string[]>()
  for (const segment of segments) {
    const { graphic, form, pts, a, b } = segment
    const hits = anchors.filter(anchor => inside(anchor.at, a, b))
    const cuts = [...new Map(hits.map(anchor => [anchor.at.map(n => n.toFixed(6)).join(','), anchor.at])).values()]
    if (!cuts.length) continue
    const axis = Math.abs(a[0] - b[0]) < EPS ? 1 : 0
    cuts.sort((p, q) => (p[axis] - q[axis]) * Math.sign(b[axis] - a[axis]))
    const points = [a, ...cuts.map(p => axis === 0 ? [p[0], a[1]] as FlatPoint : [a[0], p[1]] as FlatPoint), b]
    const identity = children(form, 'uuid')[0]!, oldId = value(identity), newIds: string[] = []
    replacements.set(graphic, points.slice(1).map((end, i) => {
      const uuid = i === 0 ? oldId : randomUUID()
      if (i) newIds.push(uuid)
      return applyEdits(graphic, [
        { start: pts.start, end: pts.end, text: `(pts (xy ${points[i]!.join(' ')}) (xy ${end.join(' ')}))` },
        { start: identity.start, end: identity.end, text: `(uuid ${quote(uuid)})` },
      ])
    }))
    groups.set(oldId, newIds)
    for (const hit of hits) {
      const key = hit.at.map(n => n.toFixed(6)).join(',')
      const owners = cutsAt.get(key) ?? new Set<number>()
      owners.add(anchors.indexOf(hit)); cutsAt.set(key, owners)
    }
  }
  const added: string[] = []
  for (const owners of cutsAt.values()) {
    const anchor = anchors[[...owners][0]!]!
    if (junctions.some(p => same(p, anchor.at))) continue
    const uuid = randomUUID()
    added.push(`(junction (at ${anchor.at.join(' ')}) (diameter 0) (color 0 0 0 0) (uuid ${quote(uuid)}))`)
    junctions.push(anchor.at)
    for (const owner of owners) groups.set(anchors[owner]!.uuid, [...(groups.get(anchors[owner]!.uuid) ?? []), uuid])
  }
  return { graphics: [...graphics.flatMap(g => replacements.get(g) ?? [g]), ...added], groups }
}
