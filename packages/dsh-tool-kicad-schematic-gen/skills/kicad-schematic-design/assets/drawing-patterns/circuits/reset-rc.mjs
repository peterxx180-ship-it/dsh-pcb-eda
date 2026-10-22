/**
 * 画法：有效低复位 RC。
 * 适用：上拉与按键同轴，电容在右下；RC 参数由实际芯片要求确定。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { ops, verticalPins } from '../shared/pattern-ops.mjs';

export function place({ region, at, parts, references, nets }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  at = region.snap(at);
  const draw = ops(region, at);
  const pullupResistor = draw.put(parts.resistor, references.resistor, 15.24, 11.43);
  const resetButton = draw.put(parts.button, references.button, 15.24, 34.29);
  const resetCapacitor = draw.put(parts.capacitor, references.capacitor, 43.18, 34.29);
  for (const p of [pullupResistor, resetButton, resetCapacitor]) {
    verticalPins(p('top'), p('bottom'));
  }
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: at, size: [76.2, 57.15] },
    ports: { reset: { reference: references.button, pin: parts.button.pins.top } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      draw.wire(draw.at(15.24, 1.27), pullupResistor('top'));
      draw.wire(pullupResistor('bottom'), resetButton('top'));
      draw.wire(draw.at(15.24, 22.86), draw.at(66.04, 22.86));
      draw.junction(draw.at(15.24, 22.86));
      draw.wire(draw.at(43.18, 22.86), resetCapacitor('top'));
      draw.junction(draw.at(43.18, 22.86));
      for (const p of [resetButton, resetCapacitor]) {
        const end = [p('bottom')[0], at[1] + 49.53];
        draw.wire(p('bottom'), end);
        draw.label(nets.ground, end);
      }
      draw.label(nets.supply, draw.at(15.24, 1.27));
      draw.label(nets.reset, draw.at(66.04, 22.86));
    }
  };
}
