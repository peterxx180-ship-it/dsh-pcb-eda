/** 仅供维护：四脚 DC/DC 是抽象示意符号，禁止替代实际控制器进入正式工程。 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { symbolLibrary } from '../../runtime.mjs';
import { place as buck } from '../circuits/buck-asynchronous.mjs';
import { place as boost } from '../circuits/boost-asynchronous.mjs';

export function dcdcFixtures(output) {
  const path = join(output, '_fixtures');
  mkdirSync(path, { recursive: true });
  const libraryPath = join(path, 'illustrative-dcdc.kicad_sym');
  const pin = (number, name, x, y, angle) => `(pin passive line (at ${x} ${y} ${angle}) (length 2.54)
  (name "${name}" (effects (font (size 1.27 1.27)))) (number "${number}" (effects (font (size 1.27 1.27)))))`;
  writeFileSync(libraryPath, `(kicad_symbol_lib (version 20211014) (generator drawing_fixture)
  (symbol "DC_DC" (property "Reference" "U" (at 0 7.62 0) (effects (font (size 1.27 1.27))))
  (symbol "DC_DC_0_1" (rectangle (start -5.08 2.54) (end 5.08 -12.7)
   (stroke (width 0.254) (type default)) (fill (type background))))
  (symbol "DC_DC_1_1" ${pin('1', 'VIN', -7.62, 0, 0)} ${pin('2', 'SW', 7.62, 0, 180)}
   ${pin('3', 'FB', 7.62, -5.08, 180)} ${pin('4', 'GND', 0, -15.24, 90)})))`, 'utf8');
  const part = (name, value, pins, angle = 0) => ({ libraryPath: symbolLibrary('Device'), libId: `Device:${name}`, value, pins, angle });
  const parts = { controller: { libraryPath, libId: 'Illustration:DC_DC', value: '', hideValue: true,
      pins: { vin: '1', sw: '2', fb: '3', ground: '4' } },
    inputCapacitor: part('C', 'C_IN', { top: '1', bottom: '2' }), outputCapacitor: part('C', 'C_OUT', { top: '1', bottom: '2' }),
    inductor: part('L', 'L_PWR', { left: '1', right: '2' }, 90),
    upperResistor: part('R', 'R_FB_TOP', { top: '1', bottom: '2' }), lowerResistor: part('R', 'R_FB_BOTTOM', { top: '1', bottom: '2' }) };
  const references = { controller: 'U1', inputCapacitor: 'C1', outputCapacitor: 'C2', inductor: 'L1', diode: 'D1', upperResistor: 'R1', lowerResistor: 'R2' };
  return [
    ['buck-asynchronous', buck, { ...parts, diode: part('D_Schottky', 'D_CATCH', { cathode: '1', anode: '2' }, 270) }, references,
      { input: 'VIN', output: 'VOUT', ground: 'GND' }],
    ['boost-asynchronous', boost, { ...parts, diode: part('D_Schottky', 'D_RECT', { anode: '2', cathode: '1' }, 180) }, references,
      { input: 'VIN', output: 'VOUT', ground: 'GND' }],
  ];
}
