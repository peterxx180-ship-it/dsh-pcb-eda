/** 三脚固定输出 LDO：外围直接连线。仅适用于已核实 VIN/VOUT 对侧、GND 向下的符号。 */
import { vertical, wire, point } from '../shared/geometry.mjs';

export function place({ region, at, parts, references, nets }) {
  const [x, y] = region.snap(at);
  const { pins, ...symbol } = parts.ldo;
  if (!pins.vin || !pins.vout || !pins.gnd || pins.en || pins.tab) {
    throw new Error('Use three verified VIN/VOUT/GND roles; EN/TAB variants need their own confirmed layout');
  }
  const angle = region.symbolOrientation(symbol, { from: pins.vin, to: pins.vout, direction: 'right' });
  const centre = region.snap([x + 40.64, y + 12.7]);
  region.addSymbol({ ...symbol, reference: references.ldo, at: centre, angle, fieldAngle: angle % 180,
    referenceAt: [centre[0], centre[1] - 7.62], valueAt: [centre[0], centre[1] - 5.08] });
  const pin = role => point(region.pin(references.ldo, pins[role]));
  const vin = pin('vin'), vout = pin('vout'), ground = pin('gnd');
  if (vin[1] !== vout[1] || ground[1] <= vin[1] || ground[0] <= vin[0] || ground[0] >= vout[0]) {
    throw new Error('Three-pin LDO layout requires level VIN/VOUT and a downward ground pin between them');
  }
  const capY = ground[1] + 7.62;
  const input = vertical(region, parts.inputCapacitor, references.inputCapacitor, [vin[0] - 7.62, capY], 'top', 'bottom');
  const output = vertical(region, parts.outputCapacitor, references.outputCapacitor, [vout[0] + 7.62, capY], 'top', 'bottom');
  const groundY = Math.max(input.bottom[1], output.bottom[1], ground[1]) + 7.62;
  const inputTap = [input.top[0], vin[1]], outputTap = [output.top[0], vout[1]];
  const inputPort = [inputTap[0] - 5.08, vin[1]], outputPort = [outputTap[0] + 5.08, vout[1]];
  if (input.top[1] <= vin[1] || output.top[1] <= vout[1]) throw new Error('Capacitors require more space below the LDO');
  const endpoint = (reference, pin) => ({ reference, pin });
  return {
    ports: { input: endpoint(references.ldo, pins.vin), output: endpoint(references.ldo, pins.vout) },
    reservedBounds: { origin: [x, y], size: [101.6, groundY - y + 10.16] },
    localConnections: [
      { name: 'VIN to input capacitor', from: endpoint(references.ldo, pins.vin), to: endpoint(references.inputCapacitor, parts.inputCapacitor.pins.top) },
      { name: 'VOUT to output capacitor', from: endpoint(references.ldo, pins.vout), to: endpoint(references.outputCapacitor, parts.outputCapacitor.pins.top) },
      ...[references.inputCapacitor, references.outputCapacitor].map((reference, i) => ({ name: `${reference} to ground rail`,
        from: endpoint(reference, [parts.inputCapacitor, parts.outputCapacitor][i].pins.bottom), to: endpoint(references.ldo, pins.gnd) })),
    ],
    connect() {
      // 主通路和电容支路均拆成共享端点；标签只命名整个单元的边界。
      wire(region, inputPort, inputTap); wire(region, inputTap, vin); wire(region, inputTap, input.top);
      wire(region, vout, outputTap); wire(region, outputTap, outputPort); wire(region, outputTap, output.top);
      for (const tap of [inputTap, outputTap]) region.marker('junction', tap);
      const left = [input.bottom[0], groundY], middle = [ground[0], groundY], right = [output.bottom[0], groundY];
      wire(region, input.bottom, left); wire(region, left, middle); wire(region, middle, right);
      wire(region, output.bottom, right); wire(region, ground, middle);
      wire(region, middle, [middle[0], groundY + 5.08]); region.marker('junction', middle);
      region.label(nets.input, inputPort); region.label(nets.output, outputPort);
      region.label(nets.ground, [middle[0], groundY + 5.08]);
    },
  };
}
