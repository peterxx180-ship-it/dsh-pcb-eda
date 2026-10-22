/**
 * 画法：异步 BOOST。
 * 适用：输入电感 → SW → 整流二极管 → 输出；仅适用内部低边开关拓扑。
 * 契约：parts/引脚/位号来自项目；region 坐标单位为 mm，先 place，再统一 connect。
 */
import { ops, verticalPins, horizontalPins } from '../shared/pattern-ops.mjs';
import { feedback, grounded } from '../shared/dcdc-feedback.mjs';

export function place({ region, at, parts, references, nets }) {
  // 1. 按真实引脚角色放置；只吸附规划坐标，不吸附 pin 端点。
  at = region.snap(at);
  const draw = ops(region, at);
  const controller = draw.put(parts.controller, references.controller, 30.48, 40.64, 'above');
  const inputCapacitor = draw.put(parts.inputCapacitor, references.inputCapacitor, 10.16, 33.02);
  const inductor = draw.put(parts.inductor, references.inductor, 30.48, 18, 'above');
  const diode = draw.put(parts.diode, references.diode, 58.42, 18, 'above');
  const outputCapacitor = draw.put(parts.outputCapacitor, references.outputCapacitor, 81.28, 33.02);
  const upperResistor = draw.put(parts.upperResistor, references.upperResistor, 101.6, 43.18);
  const lowerResistor = draw.put(parts.lowerResistor, references.lowerResistor, 101.6, 68.58);
  horizontalPins(inductor('left'), inductor('right'));
  horizontalPins(diode('anode'), diode('cathode'));
  verticalPins(inputCapacitor('top'), inputCapacitor('bottom'));
  verticalPins(outputCapacitor('top'), outputCapacitor('bottom'));
  if (controller('vin')[0] <= draw.at(20.32, 0)[0] || controller('sw')[0] >= draw.at(43.18, 0)[0] || inductor('right')[0] >= draw.at(43.18, 0)[0]) {
    throw new Error('Adapt BOOST symbol geometry before routing');
  }
  // 2. 返回外部接点与预留范围；connect 延迟到全部器件放置完成后。
  return {
    reservedBounds: { origin: at, size: [127, 91.44] },
    ports: { input: { reference: references.inductor, pin: parts.inductor.pins.left }, output: { reference: references.diode, pin: parts.diode.pins.cathode } },
    connect() {
      // 3. 内部短线、分支点和标签；跨单元连线由主入口负责。
      draw.wire(draw.at(2.54, 18), inductor('left'));
      draw.wire(draw.at(10.16, 18), inputCapacitor('top'));
      draw.junction(draw.at(10.16, 18));
      draw.wire(draw.at(20.32, 18), [draw.at(20.32, 0)[0], controller('vin')[1]]);
      draw.junction(draw.at(20.32, 18));
      draw.wire([draw.at(20.32, 0)[0], controller('vin')[1]], controller('vin'));
      draw.wire(inductor('right'), diode('anode'));
      draw.wire(draw.at(43.18, 18), [draw.at(43.18, 0)[0], controller('sw')[1]]);
      draw.junction(draw.at(43.18, 18));
      draw.wire(controller('sw'), [draw.at(43.18, 0)[0], controller('sw')[1]]);
      draw.wire(diode('cathode'), draw.at(119.38, 18));
      draw.wire(draw.at(81.28, 18), outputCapacitor('top'));
      draw.junction(draw.at(81.28, 18));
      for (const p of [inputCapacitor, outputCapacitor]) {
        draw.label(nets.ground, grounded(draw, p, 'bottom'));
      }
      draw.label(nets.ground, grounded(draw, controller, 'ground', 63.5));
      feedback(draw, controller, upperResistor, lowerResistor, nets);
      draw.label(nets.input, draw.at(2.54, 18));
      draw.label(nets.output, draw.at(119.38, 18));
    }
  };
}
