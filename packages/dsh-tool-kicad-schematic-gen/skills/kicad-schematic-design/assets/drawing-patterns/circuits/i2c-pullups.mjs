/**
 * 画法：I²C 上拉。
 * 适用：两路上拉共用已确认的电压域；交叉处没有 junction 就不相连。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { ops, verticalPins } from '../shared/pattern-ops.mjs';

export function place({ region, at, parts, references, nets }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  at = region.snap(at);
  const draw = ops(region, at);
  const sclResistor = draw.put(parts.sclResistor, references.sclResistor, 24.13, 16.51);
  const sdaResistor = draw.put(parts.sdaResistor, references.sdaResistor, 49.53, 16.51);
  verticalPins(sclResistor('top'), sclResistor('bottom'));
  verticalPins(sdaResistor('top'), sdaResistor('bottom'));
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: at, size: [82.55, 52.07] },
    ports: { scl: { reference: references.sclResistor, pin: parts.sclResistor.pins.bottom },
      sda: { reference: references.sdaResistor, pin: parts.sdaResistor.pins.bottom } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      draw.wire(draw.at(24.13, 5.08), draw.at(49.53, 5.08));
      for (const p of [sclResistor, sdaResistor]) {
        draw.wire([p('top')[0], at[1] + 5.08], p('top'));
      }
      for (const [p, dy, net] of [[sclResistor, 31.75, nets.scl], [sdaResistor, 43.18, nets.sda]]) {
        const node = [p('bottom')[0], at[1] + dy];
        draw.wire(p('bottom'), node);
        draw.wire(draw.at(6.35, dy), draw.at(69.85, dy));
        draw.junction(node);
        draw.label(net, draw.at(6.35, dy));
      }
      draw.label(nets.supply, draw.at(24.13, 5.08));
    }
  };
}
