/**
 * 画法：芯片供电脚旁去耦。
 * 适用：芯片必须已放置；只连接已确认的同一供电域，不重复放置芯片。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { ops, verticalPins } from '../shared/pattern-ops.mjs';
import { point } from '../shared/geometry.mjs';

export function place({ region, parts, references, nets }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  const supply = point(region.pin(references.chip, parts.chip.pins.supply));
  const ground = point(region.pin(references.chip, parts.chip.pins.ground));
  if (supply[1] >= ground[1] || supply[0] !== ground[0]) {
    throw new Error('Example needs aligned upper supply/lower ground pins; adapt other IC orientations explicitly');
  }
  const topY = supply[1] - 5.08;
  const bottomY = ground[1] + 5.08;
  const draw = ops(region, [0, 0]);
  const y = region.snap([0, (supply[1] + ground[1]) / 2])[1];
  const caps = [parts.bulkCapacitor, parts.highFrequencyCapacitor].map((part, i) => draw.put(part, [references.bulkCapacitor, references.highFrequencyCapacitor][i], supply[0] - [43.18, 20.32][i], y));
  for (const c of caps) {
    verticalPins(c('top'), c('bottom'));
    if (c('top')[1] <= topY || c('bottom')[1] >= bottomY) {
      throw new Error('Insufficient supply/ground span for these capacitors; adapt the local layout');
    }
  }
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: [supply[0] - 48.26, topY - 7.62], size: [66.04, bottomY - topY + 15.24] },
    ports: { supply: { reference: references.chip, pin: parts.chip.pins.supply }, ground: { reference: references.chip, pin: parts.chip.pins.ground } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      draw.wire(supply, [supply[0], topY]);
      draw.wire(ground, [ground[0], bottomY]);
      draw.wire([caps[0]('top')[0], topY], [supply[0], topY]);
      draw.wire([caps[0]('bottom')[0], bottomY], [ground[0], bottomY]);
      for (const c of caps) {
        draw.wire([c('top')[0], topY], c('top'));
        draw.wire(c('bottom'), [c('bottom')[0], bottomY]);
      }
      draw.junction([caps[1]('top')[0], topY]);
      draw.junction([caps[1]('bottom')[0], bottomY]);
      draw.label(nets.supply, [supply[0], topY]);
      draw.label(nets.ground, [ground[0], bottomY]);
    }
  };
}
