/**
 * 画法：正直流电源入口。
 * 适用：保险丝 → 串联防反接二极管 → TVS/电容；不是通用浪涌保护保证。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { ops, verticalPins, horizontalPins } from '../shared/pattern-ops.mjs';

export function place({ region, at, parts, references, nets }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  at = region.snap(at);
  const draw = ops(region, at);
  const fuse = draw.put(parts.fuse, references.fuse, 17.78, 11.43, 'above');
  const diode = draw.put(parts.diode, references.diode, 44.45, 11.43, 'above');
  const tvs = draw.put(parts.tvs, references.tvs, 64.77, 30.48);
  const cap = draw.put(parts.capacitor, references.capacitor, 87.63, 30.48);
  horizontalPins(fuse('left'), fuse('right'));
  horizontalPins(diode('anode'), diode('cathode'));
  verticalPins(tvs('signal'), tvs('ground'));
  verticalPins(cap('top'), cap('bottom'));
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: at, size: [114.3, 57.15] },
    ports: { input: { reference: references.fuse, pin: parts.fuse.pins.left },
      output: { reference: references.diode, pin: parts.diode.pins.cathode } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      draw.wire(draw.at(3, 11.43), fuse('left'));
      draw.wire(fuse('right'), diode('anode'));
      draw.wire(diode('cathode'), draw.at(104.14, 11.43));
      for (const [p, top, bottom] of [[tvs, 'signal', 'ground'], [cap, 'top', 'bottom']]) {
        const node = [p(top)[0], at[1] + 11.43];
        draw.wire(node, p(top));
        draw.junction(node);
        draw.wire(p(bottom), [p(bottom)[0], at[1] + 45.72]);
      }
      draw.wire(draw.at(64.77, 45.72), draw.at(87.63, 45.72));
      draw.wire(draw.at(76.2, 45.72), draw.at(76.2, 52.07));
      draw.junction(draw.at(76.2, 45.72));
      draw.label(nets.input, draw.at(3, 11.43));
      draw.label(nets.output, draw.at(104.14, 11.43));
      draw.label(nets.ground, draw.at(76.2, 52.07));
    }
  };
}
