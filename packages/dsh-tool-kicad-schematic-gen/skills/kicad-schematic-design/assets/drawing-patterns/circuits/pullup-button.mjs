/**
 * 画法：有效低上拉按键。
 * 适用：上拉与按键竖向对齐；BOOT 不自动添加 RC。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { vertical, wire } from '../shared/geometry.mjs';

export function place({ region, at, parts, references, nets }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  const [x, y] = region.snap(at);
  const resistor = vertical(region, parts.resistor, references.resistor, [x + 7.62, y + 11.43], 'top', 'bottom');
  const button = vertical(region, parts.button, references.button, [x + 7.62, y + 31.75], 'top', 'bottom');
  const node = [resistor.bottom[0], resistor.bottom[1] + 5.08];
  const supply = [resistor.top[0], resistor.top[1] - 5.08];
  const ground = [button.bottom[0], button.bottom[1] + 5.08];
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: [x, y], size: [39.37, 48.26] },
    ports: { signal: { reference: references.button, pin: parts.button.pins.top } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      wire(region, supply, resistor.top);
      wire(region, resistor.bottom, node);
      wire(region, node, button.top);
      const signal = [node[0] + 15.24, node[1]];
      wire(region, node, signal);
      region.marker('junction', node);
      wire(region, button.bottom, ground);
      region.label(nets.supply, supply);
      region.label(nets.signal, signal);
      region.label(nets.ground, ground);
    },
  };
}
