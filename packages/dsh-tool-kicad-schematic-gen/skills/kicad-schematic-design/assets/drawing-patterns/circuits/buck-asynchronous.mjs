/**
 * 画法：异步 BUCK。
 * 适用：SW → 电感 → 输出，续流二极管从地接到 SW；不适用同步整流。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { ops, verticalPins, horizontalPins } from '../shared/pattern-ops.mjs';
import { feedback, grounded } from '../shared/dcdc-feedback.mjs';

export function place({ region, at, parts, references, nets }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  at = region.snap(at);
  const draw = ops(region, at);
  const controller = draw.put(parts.controller, references.controller, 30.48, 18, 'above');
  const inputCapacitor = draw.put(parts.inputCapacitor, references.inputCapacitor, 10.16, 33.02);
  const inductor = draw.put(parts.inductor, references.inductor, 55.88, 18, 'above');
  const diode = draw.put(parts.diode, references.diode, 43.18, 33.02);
  const outputCapacitor = draw.put(parts.outputCapacitor, references.outputCapacitor, 81.28, 33.02);
  const upperResistor = draw.put(parts.upperResistor, references.upperResistor, 101.6, 43.18);
  const lowerResistor = draw.put(parts.lowerResistor, references.lowerResistor, 101.6, 68.58);
  horizontalPins(controller('vin'), controller('sw'));
  horizontalPins(inductor('left'), inductor('right'));
  verticalPins(inputCapacitor('top'), inputCapacitor('bottom'));
  verticalPins(outputCapacitor('top'), outputCapacitor('bottom'));
  verticalPins(diode('cathode'), diode('anode'));
  if (controller('sw')[1] !== draw.at(0, 18)[1] || controller('sw')[0] >= draw.at(43.18, 0)[0] || inductor('left')[0] <= draw.at(43.18, 0)[0]) {
    throw new Error('Adapt BUCK symbol geometry before routing');
  }
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: at, size: [127, 91.44] },
    ports: { input: { reference: references.controller, pin: parts.controller.pins.vin }, output: { reference: references.inductor, pin: parts.inductor.pins.right } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      draw.wire(draw.at(2.54, 18), controller('vin'));
      draw.wire(draw.at(10.16, 18), inputCapacitor('top'));
      draw.junction(draw.at(10.16, 18));
      draw.wire(controller('sw'), inductor('left'));
      draw.wire(draw.at(43.18, 18), diode('cathode'));
      draw.junction(draw.at(43.18, 18));
      draw.wire(inductor('right'), draw.at(119.38, 18));
      draw.wire(draw.at(81.28, 18), outputCapacitor('top'));
      draw.junction(draw.at(81.28, 18));
      for (const [p, role] of [[inputCapacitor, 'bottom'], [outputCapacitor, 'bottom'], [diode, 'anode'], [controller, 'ground']]) {
        draw.label(nets.ground, grounded(draw, p, role));
      }
      feedback(draw, controller, upperResistor, lowerResistor, nets);
      draw.label(nets.input, draw.at(2.54, 18));
      draw.label(nets.output, draw.at(119.38, 18));
    }
  };
}
