/** DC/DC 共用布局：分压从输出取样，FB 返回线避开功率支路；grounded 返回真实接地点。 */
import { verticalPins } from './pattern-ops.mjs';
/** Explicit output divider; route under the power stage, never into SW. */
export function feedback(o, controller, upper, lower, nets) {
  verticalPins(upper('top'), upper('bottom'));
  verticalPins(lower('top'), lower('bottom'));
  const top = o.at(101.6, 18), node = o.at(101.6, 55.88), ground = o.at(101.6, 81.28);
  const channelX = controller('fb')[0] + 2.54;
  o.wire(top, upper('top'));
  o.junction(top);
  o.wire(upper('bottom'), lower('top'));
  o.wire(node, [channelX, node[1]]);
  o.junction(node);
  o.wire([channelX, node[1]], [channelX, controller('fb')[1]]);
  o.wire(controller('fb'), [channelX, controller('fb')[1]]);
  o.wire(lower('bottom'), ground);
  o.label(nets.ground, ground);
}
export function grounded(o, p, role, bottom = 45.72) {
  const end = [p(role)[0], o.at(0, bottom)[1]];
  o.wire(p(role), end);
  return end;
}
