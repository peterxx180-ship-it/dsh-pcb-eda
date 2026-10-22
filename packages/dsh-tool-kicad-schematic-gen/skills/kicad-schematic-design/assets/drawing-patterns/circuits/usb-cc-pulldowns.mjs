/** 已放置 USB-C 的 CC1/CC2 受电下拉；两个支路直接连接，阻值来自已确认方案。 */
import { vertical, wire, point } from '../shared/geometry.mjs';

export function place({ region, at, parts, references, nets, connector, direction = 'left' }) {
  if (!['left', 'right'].includes(direction)) throw new Error('CC direction must be left or right');
  const [x, y] = region.snap(at), sign = direction === 'left' ? -1 : 1;
  const roles = ['cc1', 'cc2'];
  const rows = roles.map(role => ({ role, source: point(region.pin(connector.reference, connector.pins[role])) }));
  rows.sort((a, b) => a.source[1] - b.source[1]);
  if (rows[0].source[0] !== rows[1].source[0] || rows[0].source[1] === rows[1].source[1]) {
    throw new Error('CC example requires distinct rows on the same connector side');
  }
  const branches = rows.map((row, i) => {
    const reference = references[row.role];
    const branch = vertical(region, parts.resistor, reference, [x + i * -sign * 12.7, y], 'top', 'bottom');
    if (sign * (branch.top[0] - row.source[0]) <= 0 || branch.top[1] <= rows[1].source[1]) {
      throw new Error('Place CC resistors outside the selected connector side, below both CC pins');
    }
    return { ...row, ...branch, reference };
  });
  const groundY = Math.max(...branches.map(b => b.bottom[1])) + 5.08;
  return {
    ports: {}, reservedBounds: { origin: [x - 7.62, y - 7.62], size: [38.1, groundY - y + 15.24] },
    localConnections: branches.map(b => ({ name: `${b.role} to its pulldown`,
      from: { reference: connector.reference, pin: connector.pins[b.role] }, to: { reference: b.reference, pin: parts.resistor.pins.top } })),
    connect() {
      for (const branch of branches) {
        const corner = [branch.top[0], branch.source[1]];
        wire(region, branch.source, corner); wire(region, corner, branch.top);
        wire(region, branch.bottom, [branch.bottom[0], groundY]);
      }
      const a = [branches[0].bottom[0], groundY], b = [branches[1].bottom[0], groundY];
      wire(region, a, b); wire(region, a, [a[0], groundY + 5.08]);
      region.marker('junction', a);
      region.label(nets.ground, [a[0], groundY + 5.08]);
    },
  };
}
