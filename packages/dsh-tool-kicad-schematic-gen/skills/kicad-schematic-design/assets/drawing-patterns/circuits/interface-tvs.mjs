/**
 * 画法：接口单线 TVS。
 * 适用：信号直通，TVS 向下接地；不适用多脚阵列或电源钳位阵列。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { ops, verticalPins } from '../shared/pattern-ops.mjs';

export function place({ region, at, parts, references, nets }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  at = region.snap(at);
  const draw = ops(region, at);
  const tvs = draw.put(parts.tvs, references.tvs, 30.48, 24.13);
  verticalPins(tvs('signal'), tvs('ground'));
  const node = [tvs('signal')[0], at[1] + 10.16];
  const ground = [tvs('ground')[0], at[1] + 39.37];
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: at, size: [76.2, 48.26] },
    ports: { signal: { reference: references.tvs, pin: parts.tvs.pins.signal } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      draw.wire(draw.at(6.35, 10.16), draw.at(66.04, 10.16));
      draw.wire(node, tvs('signal'));
      draw.junction(node);
      draw.wire(tvs('ground'), ground);
      draw.label(nets.signal, draw.at(6.35, 10.16));
      draw.label(nets.ground, ground);
    }
  };
}
