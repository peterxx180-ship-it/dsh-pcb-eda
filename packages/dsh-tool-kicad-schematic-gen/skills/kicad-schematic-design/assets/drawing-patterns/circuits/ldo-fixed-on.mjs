/**
 * 画法：固定输出 LDO。
 * 适用：输入电容在左、输出电容在右；仅限已确认 EN 可接 VIN 的接法。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { vertical, wire, point } from '../shared/geometry.mjs';

export function place({ region, at, parts, references, nets, enableToVin }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  const [x, y] = region.snap(at);
  if (enableToVin !== true) {
    throw new Error('This example requires a verified VIN-tied enable design');
  }
  const { pins, ...symbol } = parts.ldo;
  region.addSymbol({ ...symbol, reference: references.ldo, at: [x + 52.07, y + 11.43],
    referenceAt: [x + 52.07, y + 1], valueAt: [x + 52.07, y + 3.81] });
  const pin = role => point(region.pin(references.ldo, pins[role]));
  const vin = pin('vin');
  const vout = pin('vout');
  const en = pin('en');
  const gnd = pin('gnd');
  if (vin[0] >= x + 52.07 || vout[0] <= x + 52.07 || vin[1] !== vout[1] || en[0] !== vin[0] || en[1] <= vin[1]) {
    throw new Error('LDO example requires VIN/EN on left, VOUT on right, aligned VIN/VOUT');
  }
  const input = parts.inputCapacitors;
  const output = parts.outputCapacitors;
  if (input.length !== 2 || output.length !== 2 || references.inputCapacitors.length !== 2 || references.outputCapacitors.length !== 2) {
    throw new Error('This compact example requires two confirmed capacitors on each side');
  }
  const caps = [...input, ...output].map((part, i) => vertical(region, part, [...references.inputCapacitors, ...references.outputCapacitors][i], [x + [10.16, 30.48, 76.2, 96.52][i], y + 25.4], 'top', 'bottom'));
  const groundY = y + 40.64;
  if (caps.some(c => c.top[1] <= vin[1] || c.bottom[1] >= groundY) || gnd[1] >= groundY) {
    throw new Error('Actual symbol extents need a custom, larger LDO layout');
  }
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: [x, y], size: [114.3, 52.07] },
    ports: { input: { reference: references.ldo, pin: pins.vin }, output: { reference: references.ldo, pin: pins.vout } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      const inputStart = [x + 3.81, vin[1]];
      const outputEnd = [x + 104.14, vout[1]];
      const enableNode = [x + 39.37, vin[1]];
      wire(region, inputStart, vin);
      wire(region, vout, outputEnd);
      wire(region, enableNode, [enableNode[0], en[1]]);
      wire(region, [enableNode[0], en[1]], en);
      region.marker('junction', enableNode);
      caps.forEach((c, i) => {
        const rail = [c.top[0], i < 2 ? vin[1] : vout[1]];
        wire(region, rail, c.top);
        region.marker('junction', rail);
        wire(region, c.bottom, [c.bottom[0], groundY]);
      });
      wire(region, [caps[0].bottom[0], groundY], [caps[3].bottom[0], groundY]);
      wire(region, gnd, [gnd[0], groundY + 5.08]);
      for (const c of caps.slice(1, 3)) {
        region.marker('junction', [c.bottom[0], groundY]);
      }
      region.marker('junction', [gnd[0], groundY]);
      for (const nc of pins.nc ?? []) {
        region.marker('no_connect', point(region.pin(references.ldo, nc)));
      }
      region.label(nets.input, inputStart);
      region.label(nets.output, outputEnd);
      region.label(nets.ground, [gnd[0], groundY + 5.08]);
    },
  };
}
