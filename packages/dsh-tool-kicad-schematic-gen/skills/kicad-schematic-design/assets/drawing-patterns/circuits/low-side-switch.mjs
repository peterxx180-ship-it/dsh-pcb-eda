/**
 * 画法：NMOS / NPN 低边开关。
 * 适用：kind 区分栅极与基极驱动；示例是电阻负载，不包含感性负载续流。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { ops, verticalPins, horizontalPins } from '../shared/pattern-ops.mjs';

export function place({ region, at, parts, references, nets, kind }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  at = region.snap(at);
  if (!['nmos', 'npn'].includes(kind)) {
    throw new Error('Select verified nmos or npn low-side topology');
  }
  const draw = ops(region, at);
  const q = draw.put(parts.transistor, references.transistor, 46.99, 30.48);
  const series = draw.put(parts.seriesResistor, references.seriesResistor, 15.24, 30.48, 'above');
  const pull = draw.put(parts.pulldown, references.pulldown, 30.48, 45.72);
  const loadX = q('high')[0] - at[0];
  const load = draw.put(parts.load, references.load, loadX, 10.16);
  horizontalPins(series('left'), series('right'));
  verticalPins(pull('top'), pull('bottom'));
  verticalPins(q('high'), q('low'));
  verticalPins(load('top'), load('bottom'));
  if (q('control')[1] !== series('right')[1] || q('high')[0] !== load('bottom')[0]) {
    throw new Error('Adjust actual transistor orientation/load column');
  }
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: at, size: [90, 66.04] },
    ports: { control: { reference: references.seriesResistor, pin: parts.seriesResistor.pins.left },
      switched: { reference: references.transistor, pin: parts.transistor.pins.high } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      draw.wire(draw.at(3, 30.48), series('left'));
      draw.wire(series('right'), q('control'));
      draw.wire(draw.at(30.48, 30.48), pull('top'));
      draw.junction(draw.at(30.48, 30.48));
      draw.wire(load('bottom'), q('high'));
      draw.wire(draw.at(loadX, 2), load('top'));
      draw.wire(q('low'), [q('low')[0], at[1] + 58.42]);
      draw.wire(pull('bottom'), draw.at(30.48, 58.42));
      draw.wire(draw.at(30.48, 58.42), draw.at(loadX, 58.42));
      draw.wire(draw.at(loadX, 58.42), draw.at(loadX, 63.5));
      draw.junction(draw.at(loadX, 58.42));
      draw.label(nets.control, draw.at(3, 30.48));
      draw.label(nets.supply, draw.at(loadX, 2));
      draw.label(nets.ground, draw.at(loadX, 63.5));
    }
  };
}
