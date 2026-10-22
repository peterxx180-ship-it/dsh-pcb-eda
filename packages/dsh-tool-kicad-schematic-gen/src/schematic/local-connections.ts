/** Deliberate local wire paths, without resolving labels, power nets or component internals. */
import type { FlatEndpoint, FlatObject, FlatPoint } from './flat.ts'

export interface LocalWireConnection { name: string; from: FlatEndpoint; to: FlatEndpoint }

export function inspectLocalConnections(objects: FlatObject[], connections: LocalWireConnection[],
  resolve: (endpoint: FlatEndpoint) => FlatPoint) {
  const key = (p: FlatPoint) => p.map(n => Math.round(n * 1e6) / 1e6).join(',')
  const parent = new Map<string, string>()
  const find = (id: string): string => {
    let root = id
    while (parent.get(root) !== root) root = parent.get(root)!
    while (id !== root) { const next = parent.get(id)!; parent.set(id, root); id = next }
    return root
  }
  for (const wire of objects.filter(o => o.type === 'wire' && o.from && o.to)) {
    const a = key(wire.from!), b = key(wire.to!)
    if (!parent.has(a)) parent.set(a, a)
    if (!parent.has(b)) parent.set(b, b)
    parent.set(find(a), find(b))
  }
  if (!Array.isArray(connections) || connections.some(c => !c?.name?.trim())) throw new Error('Local connections require named from/to pairs')
  const checks = connections.map(connection => {
    try {
      const from = resolve(connection.from), to = resolve(connection.to)
      const a = key(from), b = key(to)
      const passed = parent.has(a) && parent.has(b) && find(a) === find(b)
      return { ...connection, passed, code: passed ? 'LOCAL_WIRE_PATH' : 'LOCAL_WIRE_PATH_MISSING' }
    } catch (error) {
      return { ...connection, passed: false, code: 'LOCAL_PIN_INVALID', message: (error as Error).message }
    }
  })
  // Failures first, so a bounded summary cannot conceal a later missing path.
  const ordered = [...checks.filter(c => !c.passed), ...checks.filter(c => c.passed)]
  return { scope: 'wire-geometry-only' as const, total: checks.length, failed: checks.filter(c => !c.passed).length,
    checks: ordered.slice(0, 40), truncated: checks.length > 40 }
}
