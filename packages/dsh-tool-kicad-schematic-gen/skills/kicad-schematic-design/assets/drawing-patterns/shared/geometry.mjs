/** 共用几何：point 只清理浮点尾差，不吸附真实引脚；vertical 在放置前按角色选方向。 */
export function point(at) {
  if (!Array.isArray(at) || at.length !== 2 || at.some(n => !Number.isFinite(n))) {
    throw new Error(`point expects finite [x, y], received ${JSON.stringify(at)}; use region.pin inside a region`);
  }
  return at.map(n => Math.round(n * 1e6) / 1e6);
}

/** 从局部引脚点偏移；不传 pin[0]，不混入全图坐标。 */
export function shift(at, dx = 0, dy = 0) {
  const [x, y] = point(at);
  return point([x + dx, y + dy]);
}

export function vertical(region, part, reference, at, upper, lower) {
  at = region.snap(at);
  const { pins, ...symbol } = part;
  const angle = region.symbolOrientation(symbol, { from: pins[upper], to: pins[lower], direction: 'down' });
  const fieldGap = reference.startsWith('D') ? 7.62 : 3.81;
  region.addSymbol({ ...symbol, angle, reference, at, fieldAngle: angle % 180, fieldJustify: 'left',
    referenceAt: [at[0] + fieldGap, at[1] - 1.27], valueAt: [at[0] + fieldGap, at[1] + 1.27] });
  const top = point(region.pin(reference, pins[upper]));
  const bottom = point(region.pin(reference, pins[lower]));
  if (top[0] !== bottom[0] || top[1] >= bottom[1]) {
    throw new Error(`${reference}: choose a vertical symbol orientation matching ${upper}/${lower}`);
  }
  return {
    top, bottom
  };
}
export function wire(region, from, to) {
  const a = point(from), b = point(to);
  if (a[0] !== b[0] || a[1] !== b[1]) {
    region.wire(a, b);
  }
}
