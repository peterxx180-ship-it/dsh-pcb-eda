/**
 * 画法：两端无源晶振与负载电容。
 * 适用：晶体水平、两侧电容向下接地；不适用有源振荡器。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { ops, verticalPins, horizontalPins } from '../shared/pattern-ops.mjs';

export function place({ region, at, parts, references, nets }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  at = region.snap(at);
  const draw = ops(region, at);
  const crystal = draw.put(parts.crystal, references.crystal, 31.75, 13.97);
  const leftCapacitor = draw.put(parts.leftCapacitor, references.leftCapacitor, 17.78, 25.4);
  const rightCapacitor = draw.put(parts.rightCapacitor, references.rightCapacitor, 45.72, 25.4);
  horizontalPins(crystal('left'), crystal('right'));
  verticalPins(leftCapacitor('top'), leftCapacitor('bottom'));
  verticalPins(rightCapacitor('top'), rightCapacitor('bottom'));
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: at, size: [73.66, 45.72] },
    ports: { left: { reference: references.crystal, pin: parts.crystal.pins.left },
      right: { reference: references.crystal, pin: parts.crystal.pins.right } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      const left = draw.at(17.78, 13.97);
      const right = draw.at(45.72, 13.97);
      draw.wire(draw.at(5.08, 13.97), crystal('left'));
      draw.wire(crystal('right'), draw.at(59.69, 13.97));
      draw.wire(left, leftCapacitor('top'));
      draw.wire(right, rightCapacitor('top'));
      draw.junction(left);
      draw.junction(right);
      draw.wire(leftCapacitor('bottom'), draw.at(17.78, 35.56));
      draw.wire(rightCapacitor('bottom'), draw.at(45.72, 35.56));
      draw.wire(draw.at(17.78, 35.56), draw.at(45.72, 35.56));
      draw.wire(draw.at(31.75, 35.56), draw.at(31.75, 40.64));
      draw.junction(draw.at(31.75, 35.56));
      draw.label(nets.left, draw.at(5.08, 13.97));
      draw.label(nets.right, draw.at(59.69, 13.97));
      draw.label(nets.ground, draw.at(31.75, 40.64));
    }
  };
}
