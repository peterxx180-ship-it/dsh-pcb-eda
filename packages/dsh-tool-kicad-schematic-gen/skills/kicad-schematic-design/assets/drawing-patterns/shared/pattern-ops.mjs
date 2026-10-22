/** 共用绘图：at 用于规划格点位置，put 使用实际器件与已核实的角色；不决定电气取值。 */
import { point, wire } from './geometry.mjs';

export function ops(region, [x, y]) {
  const at = (dx, dy) => region.snap(point([x + dx, y + dy]));
  return {
    at, wire: (a, b) => wire(region, a, b),
    put(part, reference, dx, dy, fields = 'right') {
      const { pins, ...symbol } = part;
      const angle = pins.top && pins.bottom
        ? region.symbolOrientation(symbol, { from: pins.top, to: pins.bottom, direction: 'down' })
        : pins.left && pins.right
          ? region.symbolOrientation(symbol, { from: pins.left, to: pins.right, direction: 'right' })
          : part.angle ?? 0;
      const gap = reference.startsWith('Q') ? 7.62 : 3.81;
      region.addSymbol({ ...symbol, angle, reference, at: at(dx, dy), fieldAngle: angle % 180,
        fieldJustify: fields === 'above' ? 'center' : 'left',
        referenceAt: fields === 'above' ? at(dx, dy - 5.08) : at(dx + gap, dy - 1.27),
        valueAt: fields === 'above' ? at(dx, dy - 2.54) : at(dx + gap, dy + 1.27) });
      return role => {
        if (!pins[role]) {
          throw new Error(`${reference}: missing verified pin role ${role}`);
        }
        return point(region.pin(reference, pins[role]));
      };
    },
    junction: p => region.marker('junction', p), label: (net, p) => region.label(net, p),
  };
}
export function verticalPins(top, bottom) {
  if (top[0] !== bottom[0] || top[1] >= bottom[1]) {
    throw new Error('Expected verified top/bottom symbol orientation');
  }
}
export function horizontalPins(left, right) {
  if (left[1] !== right[1] || left[0] >= right[0]) {
    throw new Error('Expected verified left/right symbol orientation');
  }
}
