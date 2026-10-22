/**
 * 画法：信号标签按侧对齐。
 * 适用：只处理已确认侧边且尚未接线的信号脚；不重复标注电源、地或 NC。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { attachPinLabels } from '../../runtime.mjs';

export function labelSide(target, reference, direction, pins, alignAt) {
  // 一次传入同侧信号，复用构建库的统一引线基线。
  return attachPinLabels(target, { reference, direction, pins, length: 5.08, alignAt });
}
// Example after placing the actual symbol (pin numbers must match that symbol):
// labelSide(region, 'U1', 'left', [{pin:'1', net:'EN'}, {pin:'2', net:'GPIO0'}]);
// labelSide(region, 'U1', 'down', [{pin:'3', net:'GPIO1'}, {pin:'4', net:'GPIO2'}]);
