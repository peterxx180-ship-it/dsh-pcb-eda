/** 仅供维护：通用符号与占位参数；不是生产项目的选型表。 */
import { symbolLibrary } from '../../runtime.mjs';
import { place as tvs } from '../circuits/interface-tvs.mjs';
import { place as i2c } from '../circuits/i2c-pullups.mjs';
import { place as crystal } from '../circuits/crystal-load.mjs';
import { place as driver } from '../circuits/low-side-switch.mjs';
import { place as entry } from '../circuits/power-entry.mjs';
import { place as adc } from '../circuits/adc-divider.mjs';
import { place as reset } from '../circuits/reset-rc.mjs';
import { place as decoupling } from '../circuits/chip-decoupling.mjs';
import { place as series } from '../circuits/connector-series.mjs';
import { place as ldo3 } from '../circuits/ldo-fixed-3pin.mjs';
import { place as cc } from '../circuits/usb-cc-pulldowns.mjs';
const part = (name, value, pins, angle = 0) => ({ libraryPath: symbolLibrary('Device'), libId: `Device:${name}`, value, pins, angle });
const r = part('R', 'R_PULL', { top: '1', bottom: '2' });
const c = part('C', 'C_LOAD', { top: '1', bottom: '2' });
const tv = part('D_TVS', 'TVS', { signal: '1', ground: '2' }, 270);
const makeDriver = kind => {
  const transistor = kind === 'nmos' ? part('Q_NMOS', 'NMOS', { control: 'G', high: 'D', low: 'S' }) :
    part('Q_NPN', 'NPN', { control: 'B', high: 'C', low: 'E' });
  return [`${kind}-low-side`, driver, { transistor,
      seriesResistor: part('R', kind === 'nmos' ? 'R_GATE' : 'R_BASE', { left: '1', right: '2' }, 90),
      pulldown: { ...r, value: 'R_PD' }, load: { ...r, value: 'LOAD_R' } },
    { transistor: 'Q1', seriesResistor: 'R1', pulldown: 'R2', load: 'R3' },
    { control: 'CTRL', supply: '+3V3', ground: 'GND' }, { kind }];
};

export function extraFixtures() {
  return [
    ['ldo-fixed-3pin', ldo3, {
      ldo: { libraryPath: symbolLibrary('Regulator_Linear'), libId: 'Regulator_Linear:AMS1117-3.3', value: 'LDO_FIXED', pins: { vin: '3', vout: '2', gnd: '1' } },
      inputCapacitor: { ...c, value: 'C_IN' }, outputCapacitor: { ...c, value: 'C_OUT' },
    }, { ldo: 'U1', inputCapacitor: 'C1', outputCapacitor: 'C2' }, { input: '+5V', output: '+3V3', ground: 'GND' }],
    ['usb-cc-pulldowns', args => {
      // Two-pin fixture shows only verified CC-role wiring, not a complete USB-C symbol.
      args.region.addSymbol({ libraryPath: symbolLibrary('Connector_Generic'), libId: 'Connector_Generic:Conn_01x02',
        reference: 'J1', value: 'CC_ROLES_ONLY', at: args.region.snap([55.88, 15.24]) });
      return cc({ ...args, at: [35.56, 40.64], connector: { reference: 'J1', pins: { cc1: '1', cc2: '2' } }, direction: 'left' });
    }, { resistor: { ...r, value: 'R_CC' } }, { cc1: 'R1', cc2: 'R2' }, { ground: 'GND' }],
    ['adc-divider', adc, { upperResistor: { ...r, value: 'R_TOP' }, lowerResistor: { ...r, value: 'R_BOTTOM' },
        capacitor: { ...c, value: 'C_FILTER' } }, { upperResistor: 'R1', lowerResistor: 'R2', capacitor: 'C1' },
      { input: 'VIN_SENSE', adc: 'ADC_IN', ground: 'GND' }],
    ['reset-rc', reset, { resistor: r, capacitor: { ...c, value: 'C_RESET' }, button: {
          libraryPath: symbolLibrary('Switch'), libId: 'Switch:SW_Push', value: 'RESET', angle: 270,
          pins: { top: '1', bottom: '2' }
        } }, { resistor: 'R1', capacitor: 'C1', button: 'SW1' },
      { supply: '+3V3', reset: 'RESET_N', ground: 'GND' }],
    ['connector-series', args => {
        const { pins, ...symbol } = args.parts.connector;
        const angle = args.region.symbolOrientation(symbol, { pins: [pins.signal], facing: 'right' });
        args.region.addSymbol({ ...symbol, angle, reference: args.references.connector, at: args.region.snap([22.86, 30.48]),
          referenceAt: [22.86, 17.78], valueAt: [22.86, 21.59] });
        return series(args);
      }, { connector: { libraryPath: symbolLibrary('Connector_Generic'), libId: 'Connector_Generic:Conn_01x01',
          value: 'INTERFACE', angle: 180, pins: { signal: '1' } },
        resistor: part('R', 'R_SERIES', { left: '1', right: '2' }, 90) },
      { connector: 'J1', resistor: 'R1' }, { internal: 'SIGNAL_INT' }],
    ['chip-decoupling', args => {
        const { pins, ...symbol } = args.parts.chip;
        args.region.addSymbol({ ...symbol, reference: args.references.chip, at: args.region.snap([81.28, 35.56]),
          referenceAt: [95.25, 31.75], valueAt: [95.25, 35.56] });
        return decoupling(args);
      }, { chip: { libraryPath: symbolLibrary('74xx'), libId: '74xx:74HC14', unit: 7, value: 'IC_POWER',
          pins: { supply: '14', ground: '7' } }, bulkCapacitor: { ...c, value: 'C_BULK' },
        highFrequencyCapacitor: { ...c, value: 'C_HF' } },
      { chip: 'U1', bulkCapacitor: 'C1', highFrequencyCapacitor: 'C2' }, { supply: '+3V3', ground: 'GND' }],
    ['interface-tvs', tvs, { tvs: tv }, { tvs: 'D1' }, { signal: 'SIGNAL', ground: 'GND' }],
    ['i2c-pullups', i2c, { sclResistor: r, sdaResistor: r }, { sclResistor: 'R1', sdaResistor: 'R2' },
      { supply: '+3V3', scl: 'SCL', sda: 'SDA' }],
    ['crystal-load', crystal, { crystal: part('Crystal', 'XTAL', { left: '1', right: '2' }),
        leftCapacitor: c, rightCapacitor: c }, { crystal: 'Y1', leftCapacitor: 'C1', rightCapacitor: 'C2' },
      { left: 'XTAL_IN', right: 'XTAL_OUT', ground: 'GND' }],
    makeDriver('nmos'), makeDriver('npn'),
    ['power-entry', entry, { fuse: part('Fuse', 'FUSE', { left: '1', right: '2' }, 90),
        diode: part('D_Schottky', 'D_REV', { anode: '2', cathode: '1' }, 180), tvs: tv,
        capacitor: { ...c, value: 'C_BULK' } }, { fuse: 'F1', diode: 'D1', tvs: 'D2', capacitor: 'C1' },
      { input: 'VIN_RAW', output: 'VIN_PROTECTED', ground: 'GND' }],
  ];
}
