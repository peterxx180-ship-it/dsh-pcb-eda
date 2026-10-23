/** One entry point combines independently authored modules into one editable sheet. */
import { isAbsolute, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Schematic, templateDir, symbolLibrary } from '../runtime.mjs';
import { parts } from './shared/parts.mjs';
import { place as placeInput } from './modules/input.mjs';
import { place as placeOutput } from './modules/output.mjs';

const outputDirectory = process.argv[2];
if (!outputDirectory || !isAbsolute(outputDirectory)) {
  throw new Error('usage: node design.mjs <absolute-unique-candidate-directory>');
}
const sch = new Schematic({
  projectName: 'modular_demo', title: 'Modular script example', paper: 'A4',
  templateDir,
});
// Optional plan argument lets this fixture run in place or after copying to a project.
const fixturePlan = fileURLToPath(new URL('./module-plan.json', import.meta.url));
const planPath = process.argv[3] ?? (existsSync(fixturePlan) ? fixturePlan
  : fileURLToPath(new URL('../module-plan.json', import.meta.url)));
const plan = JSON.parse(readFileSync(resolve(planPath), 'utf8'));
if (plan.interfacesFrozen !== true) throw new Error('Freeze verified module interfaces before building');
const specs = Object.fromEntries(plan.modules.map(module => [module.id, module]));
const layout = {
  input: { name: 'Input', description: 'Input resistor', ...specs.input.layout },
  output: { name: 'Output', description: 'Output resistor', ...specs.output.layout },
};
const regions = Object.fromEntries(Object.entries(layout).map(([key, spec]) => [key, sch.region(spec)]));
const input = placeInput({ region: regions.input, parts, references: specs.input.references,
  nets: { supply: '+3V3' }, bounds: layout.input });
const output = placeOutput({ region: regions.output, parts, references: specs.output.references,
  nets: { ground: 'GND' }, bounds: layout.output });
for (const [id, module] of Object.entries({ input, output })) {
  if (JSON.stringify(module.ports) !== JSON.stringify(specs[id].ports)) {
    throw new Error(`Module port differs from frozen plan: ${id}`);
  }
}
const layoutReport = sch.layoutReport();
if (layoutReport.total) throw new Error(JSON.stringify(layoutReport));
for (const module of [input, output]) module.connect();

// Cross-region routes use global pin positions and an explicit routing channel.
const a = sch.pin(input.ports.signal.reference, input.ports.signal.pin);
const b = sch.pin(output.ports.signal.reference, output.ports.signal.pin);
sch.wire(a, b, [[110.49, a[1]], [110.49, b[1]]]);
sch.label('SIGNAL', a);
const localReport = sch.localConnectionsReport([
  ...input.localConnections, ...output.localConnections,
  { name: 'cross-region signal', from: input.ports.signal, to: output.ports.signal },
]);
if (localReport.failed) throw new Error(JSON.stringify(localReport));
sch.replacePowerLabels({
  libraryPath: symbolLibrary('power'),
  nets: { '+3V3': 'power:+3V3', GND: 'power:GND' },
});
console.log(JSON.stringify(sch.save(outputDirectory)));
