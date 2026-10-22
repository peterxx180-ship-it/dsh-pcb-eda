/**
 * 画法：连接器与串联电阻。
 * 适用：连接器必须已放置且目标信号脚向右；保持物理脚号，不重复放置接头。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { ops, horizontalPins } from '../shared/pattern-ops.mjs';
import { point } from '../shared/geometry.mjs';

export function place({ region, parts, references, nets }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  const draw = ops(region, [0, 0]);
  const pin = point(region.pin(references.connector, parts.connector.pins.signal));
  const resistor = draw.put(parts.resistor, references.resistor, pin[0] + 15.24, pin[1], 'above');
  horizontalPins(resistor('left'), resistor('right'));
  if (pin[1] !== resistor('left')[1] || pin[0] >= resistor('left')[0]) {
    throw new Error('Connector example needs an on-grid right-facing signal pin');
  }
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: [pin[0], pin[1] - 12.7], size: [45.72, 22.86] },
    ports: { external: { reference: references.connector, pin: parts.connector.pins.signal },
      internal: { reference: references.resistor, pin: parts.resistor.pins.right } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      const end = [resistor('right')[0] + 12.7, pin[1]];
      draw.wire(pin, resistor('left'));
      draw.wire(resistor('right'), end);
      draw.label(nets.internal, end);
    }
  };
}
