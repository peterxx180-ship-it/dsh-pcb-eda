/**
 * 画法：同域去耦电容组。
 * 适用：电容并列，电源在上、地在下；LDO 或芯片外围优先使用所属器件画法。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { vertical, wire } from '../shared/geometry.mjs';

export function place({ region, at, parts, references, nets, pitch = 20.32 }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  const [x, y] = region.snap(at);
  if (!parts.capacitors.length || parts.capacitors.length !== references.capacitors.length || pitch < 15.24) {
    throw new Error('Provide matching nonempty capacitor/reference arrays and pitch >= 15.24 mm');
  }
  const caps = parts.capacitors.map((part, i) => vertical(region, part, references.capacitors[i], [x + 7.62 + i * pitch, y + 16.51], 'top', 'bottom'));
  const topY = Math.min(...caps.map(c => c.top[1])) - 5.08;
  const bottomY = Math.max(...caps.map(c => c.bottom[1])) + 5.08;
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: [x, y], size: [31.75 + (caps.length - 1) * pitch, 35.56] },
    ports: { supply: { reference: references.capacitors[0], pin: parts.capacitors[0].pins.top },
      ground: { reference: references.capacitors[0], pin: parts.capacitors[0].pins.bottom } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      caps.forEach((c, i) => {
        const top = [c.top[0], topY];
        const bottom = [c.bottom[0], bottomY];
        wire(region, top, c.top);
        wire(region, c.bottom, bottom);
        if (i) {
          wire(region, [caps[i - 1].top[0], topY], top);
          wire(region, [caps[i - 1].bottom[0], bottomY], bottom);
        }
        if (i < caps.length - 1) {
          region.marker('junction', top);
          region.marker('junction', bottom);
        }
      });
      region.label(nets.supply, [caps[0].top[0], topY]);
      region.label(nets.ground, [caps[0].bottom[0], bottomY]);
    },
  };
}
