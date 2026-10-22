/**
 * 画法：分压与 ADC 输入。
 * 适用：上臂/下臂电阻竖排，滤波电容在采样节点右侧；不含过压保护。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { ops, verticalPins } from '../shared/pattern-ops.mjs';

export function place({ region, at, parts, references, nets }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  at = region.snap(at);
  const draw = ops(region, at);
  const upperResistor = draw.put(parts.upperResistor, references.upperResistor, 15.24, 10.16);
  const lowerResistor = draw.put(parts.lowerResistor, references.lowerResistor, 15.24, 33.02);
  const filterCapacitor = draw.put(parts.capacitor, references.capacitor, 43.18, 33.02);
  for (const p of [upperResistor, lowerResistor, filterCapacitor]) {
    verticalPins(p('top'), p('bottom'));
  }
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: at, size: [76.2, 55.88] },
    ports: { input: { reference: references.upperResistor, pin: parts.upperResistor.pins.top },
      adc: { reference: references.lowerResistor, pin: parts.lowerResistor.pins.top } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      draw.wire(draw.at(15.24, 1.27), upperResistor('top'));
      draw.wire(upperResistor('bottom'), lowerResistor('top'));
      draw.wire(draw.at(15.24, 21.59), draw.at(66.04, 21.59));
      draw.junction(draw.at(15.24, 21.59));
      draw.wire(draw.at(43.18, 21.59), filterCapacitor('top'));
      draw.junction(draw.at(43.18, 21.59));
      draw.wire(lowerResistor('bottom'), draw.at(15.24, 45.72));
      draw.wire(filterCapacitor('bottom'), draw.at(43.18, 45.72));
      draw.wire(draw.at(15.24, 45.72), draw.at(43.18, 45.72));
      draw.wire(draw.at(29.21, 45.72), draw.at(29.21, 50.8));
      draw.junction(draw.at(29.21, 45.72));
      draw.label(nets.input, draw.at(15.24, 1.27));
      draw.label(nets.adc, draw.at(66.04, 21.59));
      draw.label(nets.ground, draw.at(29.21, 50.8));
    }
  };
}
