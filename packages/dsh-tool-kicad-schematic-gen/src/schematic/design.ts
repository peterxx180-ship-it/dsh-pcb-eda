/** Higher-level declarations over the existing explicit drawing API. */
import {mkdirSync, writeFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {Schematic, type SchematicOptions, type SymbolPlacement} from './builder.ts'
import {buildAssembly, type AssemblyFiles} from './assembly.ts'
import type {FlatPoint} from './flat.ts'

export type LeadDirection = 'left' | 'right' | 'up' | 'down'
/** null is deliberate NC; manual reserves a pin for the normal wire API. */
export type PinConnection = string | null | {net: string; direction?: LeadDirection; length?: number} | {manual: true}
export interface ComponentPlacement extends SymbolPlacement {
  connections: Record<string, PinConnection>
}
export interface PlannedPin {
  reference: string; pin: string; net: string | null; mode: 'label' | 'nc' | 'manual'
  direction?: LeadDirection; length?: number
}

/** Place first, connect later. Rebuild from the same declarations after moving parts.
 * Local labels keep sheet boundaries explicit; there is no implicit global net or routing.
 */
export class ConnectedSchematic extends Schematic {
  private readonly planned: PlannedPin[] = []
  private applied = 0
  constructor(private readonly designOptions: SchematicOptions) { super(designOptions) }

  /** Validate the whole pin map before adding the component to the real sheet. */
  addComponent(spec: ComponentPlacement): string {
    const {connections, ...placement} = spec
    if (!connections || typeof connections !== 'object' || Array.isArray(connections)) throw new Error('connections must be a pin map')
    const probe = new Schematic(this.designOptions)
    probe.addSymbol(placement)
    const pins = probe.pinCatalog()[0]?.pins ?? []
    const numbers = new Set(pins.map(pin => pin.number))
    const missing = [...numbers].filter(pin => !Object.hasOwn(connections, pin))
    const extra = Object.keys(connections).filter(pin => !numbers.has(pin))
    if (missing.length || extra.length) throw new Error(`${spec.reference}: incomplete pin map; unassigned=[${missing.join(',')}]; unknown=[${extra.join(',')}]. Use null for NC or {manual:true} for explicit wiring.`)
    const plan: PlannedPin[] = []
    for (const pin of numbers) {
      // Ambiguous/stacked endpoints require deliberate lower-level handling.
      probe.pin(spec.reference, pin)
      const connection = connections[pin]
      if (connection === null) { plan.push({reference: spec.reference, pin, net: null, mode: 'nc'}); continue }
      if (typeof connection === 'object' && connection && 'manual' in connection) {
        if (connection.manual !== true || Object.keys(connection).length !== 1) throw new Error('manual pin requires {manual:true}')
        plan.push({reference: spec.reference, pin, net: null, mode: 'manual'}); continue
      }
      const detail = typeof connection === 'string' ? {net: connection} : connection
      if (!detail || typeof detail !== 'object' || !('net' in detail) || typeof detail.net !== 'string' || !detail.net.trim()) throw new Error(`${spec.reference}.${pin}: expected a net, null or {manual:true}`)
      if (Object.keys(detail).some(key => !['net', 'direction', 'length'].includes(key))) throw new Error('unknown pin connection option')
      const direction = detail.direction ?? probe.pinDirection(spec.reference, pin)
      const length = detail.length ?? 5.08
      if (!['left', 'right', 'up', 'down'].includes(direction) || !Number.isFinite(length) || length <= 0) throw new Error('lead requires an orthogonal direction and positive length')
      plan.push({reference: spec.reference, pin, net: detail.net, mode: 'label', direction, length})
    }
    const id = super.addSymbol(placement)
    this.planned.push(...plan)
    return id
  }

  /** Detached intent, not proof of electrical correctness or physical connectivity. */
  connectionPlan(): PlannedPin[] { return structuredClone(this.planned) }

  /** Idempotent realization of all pending labels/NCs after component placement. */
  connect(): void {
    const vectors: Record<LeadDirection, FlatPoint> = {left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1]}
    const round = (n: number) => Math.round(n * 1e6) / 1e6
    const pending = this.planned.slice(this.applied).map(plan => {
      const at = this.pin(plan.reference, plan.pin)
      const vector = plan.direction ? vectors[plan.direction] : [0, 0]
      const end: FlatPoint = [round(at[0] + vector![0]! * (plan.length ?? 0)), round(at[1] + vector![1]! * (plan.length ?? 0))]
      return {plan, at, end}
    })
    for (const {plan, at, end} of pending) {
      if (plan.mode === 'nc') this.marker('no_connect', at)
      if (plan.mode === 'label') {
        this.wire(at, end)
        const angles = {left: 180, right: 0, up: 90, down: 270} as const
        this.label(plan.net!, end, angles[plan.direction!])
      }
    }
    this.applied = this.planned.length
  }

  override render(): ReturnType<Schematic['render']> { this.connect(); return super.render() }
}

export interface ProjectSheetOptions {
  title: string
  /** Child hierarchical label -> root net. Every child port must be accounted for. */
  connections: Record<string, string>
  unconnectedPorts?: string[]
  paper?: SchematicOptions['paper']
}

/** A project-level facade reusing the existing port-checked hierarchy assembler.
 * The assembler reannotates children; final reference mappings are returned and saved.
 */
export class SchematicProject {
  private readonly sheets = new Map<string, {drawing: ConnectedSchematic; options: ProjectSheetOptions}>()
  constructor(private readonly options: SchematicOptions) {
    new Schematic(options) // Validate configuration before accepting sheets.
  }

  sheet(name: string, options: ProjectSheetOptions): ConnectedSchematic {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/u.test(name) || this.sheets.has(name)) throw new Error('sheet name must be a unique ASCII identifier')
    const snapshot = structuredClone(options)
    const drawing = new ConnectedSchematic({...this.options, projectName: `${this.options.projectName}_${name}`, title: options.title, paper: options.paper ?? this.options.paper})
    this.sheets.set(name, {drawing, options: snapshot})
    return drawing
  }

  render(): AssemblyFiles {
    return buildAssembly(this.options.projectName, this.options.title, [...this.sheets].map(([name, {drawing, options}]) => ({
      name, source: drawing.render().schematic,
      connections: Object.entries(options.connections).map(([port, net]) => ({port, net})),
      unconnectedPorts: options.unconnectedPorts ?? [],
    })))
  }

  /** Fresh output directory only. Local footprint libraries must still be supplied by the caller. */
  save(directory: string): {rootPath: string; projectPath: string; sheets: AssemblyFiles['children']; warnings: string[]} {
    const files = this.render()
    const manifest = files.children.map(child => ({name: child.name, filename: child.filename, references: child.references,
      connections: this.sheets.get(child.name)!.drawing.connectionPlan().map(pin => ({...pin, reference: child.references[pin.reference] ?? pin.reference}))}))
    mkdirSync(dirname(directory), {recursive: true})
    mkdirSync(directory) // Never overwrite an existing project.
    const write = (name: string, text: string) => {
      const path = join(directory, name); mkdirSync(dirname(path), {recursive: true}); writeFileSync(path, text, {flag: 'wx'})
    }
    write(`${this.options.projectName}.kicad_sch`, files.root)
    write(`${this.options.projectName}.kicad_pro`, files.project)
    write(`${this.options.projectName}.kicad_sym`, files.symbolLibrary)
    write('sym-lib-table', files.symbolTable)
    for (const child of files.children) write(child.filename, child.text)
    write('connection-plan.json', JSON.stringify({projectName: this.options.projectName, status: 'intent-only', sheets: manifest}, null, 2) + '\n')
    return {rootPath: join(directory, `${this.options.projectName}.kicad_sch`), projectPath: join(directory, `${this.options.projectName}.kicad_pro`), sheets: files.children, warnings: files.warnings}
  }
}
