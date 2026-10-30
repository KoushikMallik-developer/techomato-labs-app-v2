/**
 * Shared, render-agnostic circuit part library: pin layouts, colors, icons.
 * Ported from the original artifact's TYPES/ICONS/PALETTE tables — both the
 * 2D (draw2d.js) and 3D (render3d.js) renderers read from here so geometry
 * never drifts between views.
 */

export const LED_COLORS = {
  red: { fill: '#ff3b30', vf: 1.8 },
  yellow: { fill: '#ffd60a', vf: 2.0 },
  green: { fill: '#30d158', vf: 2.1 },
  blue: { fill: '#2f8bff', vf: 3.0 },
  white: { fill: '#f2f4f7', vf: 3.0 },
};

export const RES_VALUES = [
  10, 47, 100, 220, 330, 470, 560, 1000, 2200, 4700, 10000, 22000, 47000, 100000, 220000, 1000000,
];

export const RGB_CH = { R: { vf: 1.8 }, G: { vf: 2.1 }, B: { vf: 3.0 } };

export const BAND = [
  '#1a1a1a', '#8b4513', '#e0301e', '#ff8c00', '#ffd60a',
  '#2e9d3a', '#1f5fd6', '#8e44ad', '#8e8e93', '#f5f5f5',
];

export const fmtOhms = (v) =>
  (v >= 1e6 ? v / 1e6 + 'M' : v >= 1000 ? v / 1000 + 'k' : String(v)) + 'Ω';

export const LEG = 'stroke="#b4bac2" stroke-width="2" stroke-linecap="round"';

export const ARD_PINS = {};
export const ARD_LABELS = {};
export const ARD_TOP = [];
export const ARD_BOTTOM = [];
export const PWM = new Set([3, 5, 6, 9, 10, 11]);

['GND', '13', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0'].forEach(
  (l, i) => {
    const id = l === 'GND' ? 'GNDT' : 'D' + l;
    ARD_PINS[id] = [40 + i * 15 + (i >= 7 ? 8 : 0), 12];
    ARD_LABELS[id] = l;
    ARD_TOP.push(id);
  },
);
[
  ['3V3', '3V3'],
  ['5V', '5V'],
  ['GND1', 'GND'],
  ['GND2', 'GND'],
].forEach(([id, l], i) => {
  ARD_PINS[id] = [60 + i * 15, 178];
  ARD_LABELS[id] = l;
  ARD_BOTTOM.push(id);
});
for (let i = 0; i < 6; i++) {
  const id = 'A' + i;
  ARD_PINS[id] = [150 + i * 15, 178];
  ARD_LABELS[id] = id;
  ARD_BOTTOM.push(id);
}

export const BB_PINS = {};
export const BB_ROWS = { a: 40, b: 50, c: 60, d: 70, e: 80, f: 110, g: 120, h: 130, i: 140, j: 150 };
export const BB_RAILS = { tp: 10, tn: 20, bn: 180, bp: 190 };
export const RAIL_NAMES = {
  tp: 'top + rail',
  tn: 'top − rail',
  bn: 'bottom − rail',
  bp: 'bottom + rail',
};
for (let c = 1; c <= 30; c++) {
  const x = 10 + 10 * c;
  for (const r in BB_ROWS) BB_PINS[r + c] = [x, BB_ROWS[r]];
  if (c % 6) for (const r in BB_RAILS) BB_PINS[r + c] = [x, BB_RAILS[r]];
}

export const TYPES = {
  breadboard: { label: 'Breadboard', pins: BB_PINS, box: [0, 0, 330, 200], props: {} },
  arduino: { label: 'Arduino Uno', pins: ARD_PINS, box: [-14, 0, 294, 190], props: {} },
  led: { label: 'LED', pins: { A: [5, 24], K: [-5, 24] }, box: [-16, -22, 32, 50], props: { color: 'red' } },
  resistor: { label: 'Resistor', pins: { 1: [-40, 0], 2: [40, 0] }, box: [-42, -18, 84, 28], props: { ohms: 220 } },
  button: { label: 'Push button', pins: { 1: [-30, 0], 2: [30, 0] }, box: [-32, -18, 64, 36], props: {} },
  pot: { label: 'Potentiometer', pins: { A: [-10, 26], W: [0, 26], B: [10, 26] }, box: [-22, -27, 44, 72], props: { pos: 0.5 } },
  buzzer: { label: 'Buzzer', pins: { P: [-5, 26], N: [5, 26] }, box: [-21, -22, 42, 50], props: {} },
  lcd: { label: 'LCD 16×2 (I2C)', pins: { GND: [-75, 40], VCC: [-65, 40], SDA: [-55, 40], SCL: [-45, 40] }, box: [-92, -38, 184, 80], props: {} },
  sonar: { label: 'HC-SR04 ultrasonic sensor', pins: { VCC: [-15, 34], TRIG: [-5, 34], ECHO: [5, 34], GND: [15, 34] }, box: [-47, -42, 94, 78], props: { cm: 50 } },
  rgbled: { label: 'RGB LED', pins: { R: [-15, 24], G: [-5, 24], B: [5, 24], GND: [15, 24] }, box: [-24, -24, 48, 52], props: {} },
  diode: { label: 'Diode', pins: { A: [-16, 0], K: [16, 0] }, box: [-18, -10, 36, 20], props: {} },
  capacitor: { label: 'Capacitor', pins: { 1: [-10, 0], 2: [10, 0] }, box: [-16, -18, 32, 32], props: {} },
  toggle: { label: 'Slide switch', pins: { 1: [-15, 0], 2: [15, 0] }, box: [-19, -15, 38, 30], props: { on: false } },
  ldr: { label: 'Photoresistor (LDR)', pins: { A: [-10, 0], B: [10, 0] }, box: [-20, -18, 40, 32], props: { light: 70 } },
  pir: { label: 'PIR motion sensor', pins: { VCC: [-10, 26], OUT: [0, 26], GND: [10, 26] }, box: [-26, -24, 52, 54], props: {} },
  relay: { label: 'Relay module', pins: { IN: [-20, 26], GND: [-10, 26], COM: [0, 26], NO: [10, 26], NC: [20, 26] }, box: [-26, -22, 52, 52], props: {} },
  transistor: { label: 'NPN transistor', pins: { E: [-10, 20], B: [0, 20], C: [10, 20] }, box: [-16, -16, 32, 40], props: {} },
  motor: { label: 'DC motor', pins: { '+': [-8, 22], '-': [8, 22] }, box: [-24, -26, 48, 52], props: {} },
  servo: { label: 'Servo motor', pins: { GND: [-10, 34], VCC: [0, 34], S: [10, 34] }, box: [-24, -28, 48, 64], props: {} },
  sevenseg: {
    label: '7-segment display',
    pins: { a: [-31.5, 44], b: [-22.5, 44], c: [-13.5, 44], d: [-4.5, 44], e: [4.5, 44], f: [13.5, 44], g: [22.5, 44], dp: [31.5, 44], COM: [0, -44] },
    box: [-40, -52, 80, 100],
    props: {},
  },
};

export const PIN_NAMES = {
  led: { A: 'anode (+)', K: 'cathode (−)' },
  resistor: { 1: 'leg 1', 2: 'leg 2' },
  button: { 1: 'leg 1', 2: 'leg 2' },
  pot: { A: 'left leg', W: 'middle leg (wiper)', B: 'right leg' },
  buzzer: { P: '+ leg', N: '− leg' },
  lcd: { GND: 'GND', VCC: 'VCC', SDA: 'SDA', SCL: 'SCL' },
  sonar: { VCC: 'VCC', TRIG: 'TRIG', ECHO: 'ECHO', GND: 'GND' },
  rgbled: { R: 'red anode', G: 'green anode', B: 'blue anode', GND: 'common cathode (−)' },
  diode: { A: 'anode (+)', K: 'cathode (band, −)' },
  capacitor: { 1: 'leg 1', 2: 'leg 2' },
  toggle: { 1: 'leg 1', 2: 'leg 2' },
  ldr: { A: 'leg 1', B: 'leg 2' },
  pir: { VCC: 'VCC', OUT: 'signal out', GND: 'GND' },
  relay: { IN: 'control in', GND: 'control GND', COM: 'common', NO: 'normally open', NC: 'normally closed' },
  transistor: { E: 'emitter', B: 'base', C: 'collector' },
  motor: { '+': 'terminal +', '-': 'terminal −' },
  servo: { GND: 'GND', VCC: 'VCC', S: 'signal' },
  sevenseg: { a: 'segment a', b: 'segment b', c: 'segment c', d: 'segment d', e: 'segment e', f: 'segment f', g: 'segment g', dp: 'decimal point', COM: 'common cathode (GND)' },
};

export const ICONS = {
  led: '<svg viewBox="0 0 20 20"><path d="M5 11V8a5 5 0 0 1 10 0v3z" fill="#ff3b30"/><rect x="4" y="11" width="12" height="2" rx="1" fill="#ff3b30"/><path d="M8 13v5M12 13v5" stroke="#9aa1aa" stroke-width="1.5"/></svg>',
  resistor: '<svg viewBox="0 0 20 20"><path d="M1 10h4M15 10h4" stroke="#9aa1aa" stroke-width="1.5"/><rect x="4" y="6.5" width="12" height="7" rx="3.5" fill="#dcc193"/><path d="M7.5 6.5v7M10.5 6.5v7" stroke="#e0301e" stroke-width="1.4"/></svg>',
  button: '<svg viewBox="0 0 20 20"><rect x="3" y="3" width="14" height="14" rx="2" fill="#2a2d31"/><circle cx="10" cy="10" r="4.5" fill="#e5484d"/></svg>',
  pot: '<svg viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="3" fill="#2456c9"/><circle cx="10" cy="10" r="5.5" fill="#e3e6ea"/><path d="M10 10l3-3" stroke="#23272d" stroke-width="1.6" stroke-linecap="round"/></svg>',
  buzzer: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#1d1f22"/><circle cx="10" cy="10" r="5" fill="none" stroke="#4a4e54"/><circle cx="10" cy="10" r="2" fill="#000"/></svg>',
  breadboard: '<svg viewBox="0 0 20 20"><rect x="1" y="3" width="18" height="14" rx="1.5" fill="#eef0f2" stroke="#b9bfc6"/><path d="M3 5.5h14M3 14.5h14" stroke="#e5484d" stroke-width=".8"/><g fill="#555b62"><rect x="4" y="7.5" width="1.4" height="1.4"/><rect x="7" y="7.5" width="1.4" height="1.4"/><rect x="10" y="7.5" width="1.4" height="1.4"/><rect x="13" y="7.5" width="1.4" height="1.4"/><rect x="4" y="11" width="1.4" height="1.4"/><rect x="7" y="11" width="1.4" height="1.4"/><rect x="10" y="11" width="1.4" height="1.4"/><rect x="13" y="11" width="1.4" height="1.4"/></g></svg>',
  lcd: '<svg viewBox="0 0 20 20"><rect x="1" y="4" width="18" height="12" rx="1.5" fill="#1f7a3a"/><rect x="3" y="6.5" width="14" height="7" fill="#3f6fe0"/><path d="M5 9h6" stroke="#fff" stroke-width="1.2"/></svg>',
  sonar: '<svg viewBox="0 0 20 20"><rect x="1" y="5" width="18" height="10" rx="1.5" fill="#1b5fae"/><circle cx="6" cy="10" r="3.6" fill="#c9ced4"/><circle cx="14" cy="10" r="3.6" fill="#c9ced4"/></svg>',
  rgbled: '<svg viewBox="0 0 20 20"><path d="M5 11V8a5 5 0 0 1 10 0v3z" fill="#e9ecef"/><rect x="4" y="11" width="12" height="2" rx="1" fill="#c9ced4"/><circle cx="7.5" cy="8.5" r="1.3" fill="#ff3b30"/><circle cx="10" cy="8.5" r="1.3" fill="#30d158"/><circle cx="12.5" cy="8.5" r="1.3" fill="#2f8bff"/></svg>',
  diode: '<svg viewBox="0 0 20 20"><path d="M2 10h5M13 10h5" stroke="#9aa1aa" stroke-width="1.5"/><path d="M7 6v8l7-4z" fill="#2a2d31"/><rect x="14" y="6" width="1.6" height="8" fill="#c9ced4"/></svg>',
  capacitor: '<svg viewBox="0 0 20 20"><path d="M2 10h6M12 10h6" stroke="#9aa1aa" stroke-width="1.5"/><path d="M8 4v12M12 4v12" stroke="#3a6b5c" stroke-width="2"/></svg>',
  toggle: '<svg viewBox="0 0 20 20"><rect x="2" y="6" width="16" height="8" rx="4" fill="#2a2d31"/><circle cx="13" cy="10" r="4.4" fill="#e5484d"/></svg>',
  ldr: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#dcdf5f"/><path d="M5 7q5 5 10 0M5 13q5-5 10 0" stroke="#4a4d1a" stroke-width="1.2" fill="none"/></svg>',
  pir: '<svg viewBox="0 0 20 20"><path d="M3 15A7 7 0 0 1 17 15z" fill="#e9ecef"/><rect x="2" y="15" width="16" height="3" rx="1" fill="#c9ced4"/></svg>',
  relay: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="16" height="14" rx="1.5" fill="#2b6bd6"/><rect x="5" y="6" width="6" height="8" rx="1" fill="#1d1f22"/><circle cx="15" cy="7" r="1.6" fill="#e5484d"/></svg>',
  transistor: '<svg viewBox="0 0 20 20"><path d="M4 16V9a6 6 0 0 1 12 0v7z" fill="#2a2d31"/><path d="M7 16v3M10 16v3M13 16v3" stroke="#9aa1aa" stroke-width="1.5"/></svg>',
  motor: '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#4a4e54"/><circle cx="10" cy="10" r="3" fill="#c9ced4"/><rect x="9" y="0.5" width="2" height="3" fill="#9aa1aa"/></svg>',
  servo: '<svg viewBox="0 0 20 20"><rect x="3" y="6" width="14" height="11" rx="2" fill="#2456c9"/><rect x="7" y="1" width="6" height="6" rx="1" fill="#e3e6ea"/><rect x="1" y="3.5" width="10" height="1.8" rx="0.9" fill="#e3e6ea" transform="rotate(-20 6 4.5)"/></svg>',
  sevenseg: '<svg viewBox="0 0 20 20"><rect x="3" y="2" width="14" height="16" rx="1.5" fill="#1d1f22"/><g stroke="#ff3b30" stroke-width="1.6" stroke-linecap="round"><path d="M7 5h6M7 10h6M7 15h6M6.5 5.5v4M13.5 5.5v4M6.5 10.5v4M13.5 10.5v4"/></g></svg>',
};

export const PALETTE = [
  ['breadboard', 'Breadboard'],
  ['lcd', 'LCD 16×2'],
  ['sevenseg', '7-segment display'],
  ['sonar', 'Ultrasonic sensor'],
  ['ldr', 'Photoresistor'],
  ['pir', 'Motion sensor'],
  ['led', 'LED'],
  ['rgbled', 'RGB LED'],
  ['resistor', 'Resistor'],
  ['diode', 'Diode'],
  ['capacitor', 'Capacitor'],
  ['button', 'Button'],
  ['toggle', 'Slide switch'],
  ['pot', 'Potentiometer'],
  ['buzzer', 'Buzzer'],
  ['motor', 'DC motor'],
  ['servo', 'Servo motor'],
  ['relay', 'Relay module'],
  ['transistor', 'Transistor'],
];

export const WIRE_COLORS = ['#ffd166', '#4cc9f0', '#ff9f1c', '#c77dff', '#80ed99', '#f15bb5'];

/**
 * Picks a wire color from a pin's role: ground pins/rails render gray,
 * power pins/rails render red, everything else cycles through WIRE_COLORS.
 * `pinA`/`pinB` are full keys like "ard.GNDT" or "bb.tn12".
 */
export function wireColor(pinA, pinB, index) {
  const isGnd = (k) => /^GND/.test(k) || /^(tn|bn)\d/.test(k);
  const isPower = (k) => k === '5V' || k === '3V3' || /^(tp|bp)\d/.test(k);
  const pa = pinA.split('.')[1] || '';
  const pb = pinB.split('.')[1] || '';
  if (isGnd(pa) || isGnd(pb)) return '#a3adb8';
  if (isPower(pa) || isPower(pb)) return '#ff5a4f';
  return WIRE_COLORS[index % WIRE_COLORS.length];
}
