/**
 * 画法：电源指示 LED。
 * 适用：电源 → 限流电阻 → LED → 地；不直接套用 GPIO 高/低有效驱动。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { vertical, wire } from '../shared/geometry.mjs';

export function place({ region, at, parts, references, nets }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  const [x, y] = region.snap(at);
  const resistor = vertical(region, parts.resistor, references.resistor, [x + 7.62, y + 11.43], 'top', 'bottom');
  const led = vertical(region, parts.led, references.led, [x + 7.62, y + 30.48], 'anode', 'cathode');
  const supply = [resistor.top[0], resistor.top[1] - 5.08];
  const ground = [led.bottom[0], led.bottom[1] + 5.08];
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: [x, y], size: [38.1, 45.72] },
    ports: { supply: { reference: references.resistor, pin: parts.resistor.pins.top },
      ground: { reference: references.led, pin: parts.led.pins.cathode } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      wire(region, supply, resistor.top);
      wire(region, resistor.bottom, led.top);
      wire(region, led.bottom, ground);
      region.label(nets.supply, supply);
      region.label(nets.ground, ground);
    },
  };
}
