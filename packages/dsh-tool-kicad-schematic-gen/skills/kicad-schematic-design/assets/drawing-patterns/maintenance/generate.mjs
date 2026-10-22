/** 仅供维护：创建可复现示例工程，验证画法并输出 save 摘要；正常项目不要复制此脚本。 */
import { resolve, join } from 'node:path';
import { Schematic, templateDir, symbolLibrary, snapPoint } from '../../runtime.mjs';
import { place as led } from '../circuits/led-power-indicator.mjs';
import { place as button } from '../circuits/pullup-button.mjs';
import { place as bank } from '../circuits/decoupling-bank.mjs';
import { labelSide } from '../circuits/label-alignment.mjs';
import { place as ldo } from '../circuits/ldo-fixed-on.mjs';
import { extraFixtures } from './extra-fixtures.mjs';
import { dcdcFixtures } from './dcdc-fixtures.mjs';
if (!process.argv[2]) {
  throw new Error('Usage: node generate.mjs <unique-output-root>');
}
const output = resolve(process.argv[2]);
const resistor = { libraryPath: symbolLibrary('Device'), libId: 'Device:R', value: '10k',
  pins: { top: '1', bottom: '2' }, angle: 0 };
const capacitor = { libraryPath: symbolLibrary('Device'), libId: 'Device:C', value: '100n',
  pins: { top: '1', bottom: '2' }, angle: 0 };
const fixtures = [
  ['ldo-fixed-on', ldo, { ldo: { libraryPath: symbolLibrary('Regulator_Linear'),
        libId: 'Regulator_Linear:AP2112K-3.3', value: 'AP2112K-3.3', angle: 0,
        pins: { vin: '1', gnd: '2', en: '3', vout: '5', nc: [] } },
      inputCapacitors: [{ ...capacitor, value: '10u' }, capacitor],
      outputCapacitors: [{ ...capacitor, value: '10u' }, capacitor] },
    { ldo: 'U1', inputCapacitors: ['C1', 'C2'], outputCapacitors: ['C3', 'C4'] },
    { input: '+5V', output: '+3V3' }],
  ['led-power-indicator', led, { resistor: { ...resistor, value: '1k' }, led: {
        libraryPath: symbolLibrary('Device'), libId: 'Device:LED', value: 'LED', angle: 90,
        pins: { anode: '2', cathode: '1' }
      } }, { resistor: 'R1', led: 'D1' }, {}],
  ['pullup-button', button, { resistor, button: { libraryPath: symbolLibrary('Switch'),
        libId: 'Switch:SW_Push', value: 'KEY', angle: 270, pins: { top: '1', bottom: '2' } } },
    { resistor: 'R1', button: 'SW1' }, { signal: 'KEY_IN' }],
  ['decoupling-bank', bank, { capacitors: [{ ...capacitor, value: '10u' }, capacitor] },
    { capacitors: ['C1', 'C2'] }, {}],
];
for (const [id, place, parts, references, extra] of fixtures) {
  const nets = { supply: '+3V3', ground: 'GND', ...extra };
  const powers = { '+3V3': 'power:+3V3', GND: 'power:GND', ...(id === 'ldo-fixed-on' ? { '+5V': 'power:+5V' } : {}) };
  const sch = new Schematic({ projectName: id, title: id, paper: 'A4', templateDir, requiredPowerSymbols: powers, powerStyle: 'mixed' });
  const region = sch.region({ name: id, description: 'Drawing example; values are illustrative', origin: snapPoint([25, 25]), size: [id === 'ldo-fixed-on' ? 130 : 85, 80] });
  const unit = place({ region, at: [10, 12], parts, references, nets, enableToVin: id === 'ldo-fixed-on' });
  unit.connect();
  const plan = sch.planPowerPlacements({ libraryPath: symbolLibrary('power'), nets: powers });
  sch.replacePowerLabels({ libraryPath: symbolLibrary('power'), nets: powers, placements: plan.placements });
  console.log(JSON.stringify({ id, ...sch.save(join(output, id)) }));
}
for (const [id, place, parts, references, nets, options] of [...extraFixtures(), ...dcdcFixtures(output)]) {
  const powers = { ...(nets.ground ? { [nets.ground]: 'power:GND' } : {}), ...(nets.supply ? { [nets.supply]: 'power:+3V3' } : {}) };
  const sch = new Schematic({ projectName: id, title: id, paper: 'A4', templateDir, requiredPowerSymbols: powers, powerStyle: 'mixed' });
  const region = sch.region({ name: id, description: 'Layout only; select actual parts and values', origin: snapPoint([25, 25]), size: [140, id.endsWith('asynchronous') ? 125 : 100] });
  const circuit = place({ region, at: [10, 15], parts, references, nets, ...options });
  circuit.connect();
  const localConnections = sch.localConnectionsReport(circuit.localConnections ?? []);
  if (localConnections.failed) throw new Error(JSON.stringify(localConnections));
  if (Object.keys(powers).length) {
    const plan = sch.planPowerPlacements({ libraryPath: symbolLibrary('power'), nets: powers });
    sch.replacePowerLabels({ libraryPath: symbolLibrary('power'), nets: powers, placements: plan.placements });
  }
  console.log(JSON.stringify({ id, ...sch.save(join(output, id)) }));
}
// Same-page mixed power expression and connectors facing the interior of the circuit.
{
  const id = 'mixed-power', powers = { '+3V3': 'power:+3V3', GND: 'power:GND' };
  const sch = new Schematic({ projectName: id, title: id, paper: 'A4', templateDir, requiredPowerSymbols: powers, powerStyle: 'mixed' });
  const part = { libraryPath: symbolLibrary('Connector_Generic'), libId: 'Connector_Generic:Conn_01x02' };
  const keepLabels = [];
  for (const [reference, x, facing] of [['J1', 35.56, 'right'], ['J2', 96.52, 'left']]) {
    const angle = sch.symbolOrientation(part, { pins: ['1', '2'], facing });
    sch.addSymbol({ ...part, reference, value: reference === 'J1' ? 'INPUT' : 'OUTPUT', angle, at: snapPoint([x, 60.96]),
      fieldAngle: 0, referenceAt: [x, 45.72], valueAt: [x, 49.53] });
    const roles = reference === 'J1' ? [['2', '+3V3'], ['1', 'GND']] : [['1', '+3V3'], ['2', 'GND']];
    for (const [pin, net] of roles) {
      const p = sch.pin(reference, pin), end = [p[0] + (facing === 'right' ? 10.16 : -10.16), p[1]];
      sch.wire(p, end);
      const uuid = sch.label(net, end, facing === 'right' ? 180 : 0);
      if (reference === 'J2' && net === '+3V3') {
        keepLabels.push(uuid);
      }
    }
  }
  const spec = { libraryPath: symbolLibrary('power'), nets: powers, keepLabels };
  const plan = sch.planPowerPlacements(spec);
  for (const label of sch.powerLabelCatalog(Object.keys(powers))) {
    if (keepLabels.includes(label.uuid)) {
      continue;
    }
    plan.placements[label.uuid] = { at: label.at, angle: 0, valueAt: [label.at[0], label.at[1] + (label.net === 'GND' ? 5.08 : -5.08)] };
  }
  sch.replacePowerLabels({ ...spec, placements: plan.placements });
  console.log(JSON.stringify({ id, ...sch.save(join(output, id)) }));
}
// Rotate the same known fixture to exercise real label text in all four directions.
for (const [id, angle] of [['label-sides', 0], ['label-vertical', 90]]) {
  const sch = new Schematic({ projectName: id, title: id, paper: 'A4', templateDir });
  sch.addSymbol({ libraryPath: symbolLibrary('Connector_Generic'), libId: 'Connector_Generic:Conn_02x08_Odd_Even',
    reference: 'J1', value: 'LABEL_DEMO', at: snapPoint([65, 60]), angle, fieldAngle: angle,
    referenceAt: angle === 0 ? [65, 38] : [88, 57],
    valueAt: angle === 0 ? [65, 40.5] : [88, 60] });
  for (const parity of [1, 2]) {
    const pins = Array.from({ length: 8 }, (_, i) => ({ pin: String(i * 2 + parity),
      net: ['EN', 'GPIO0', 'GPIO1', 'UART_TX', 'UART_RX', 'USB_DP', 'USB_DM', 'GPIO10'][i] + (parity === 2 ? '_B' : '') }));
    const p = sch.pin('J1', pins[0].pin);
    const direction = angle === 0 ? (p[0] < 65 ? 'left' : 'right') : (p[1] < 60 ? 'up' : 'down');
    const result = labelSide(sch, 'J1', direction, pins);
    if (result.warnings.length) {
      throw new Error(JSON.stringify(result.warnings));
    }
  }
  console.log(JSON.stringify({ id, ...sch.save(join(output, id)) }));
}
