/**
 * Circuit solver: modified nodal analysis over the live board. Ties
 * together breadboard row/rail continuity, wires, and every part's
 * electrical model, then iterates a companion-model diode/LED solve to
 * convergence. This is dense numerical code ported near-verbatim from the
 * original engine rather than redesigned — see the implementation plan.
 *
 * Everything here reads/writes `sim` (engine/engineStore.js) and never
 * touches Redux: it runs inside the animation loop while a sketch is
 * running.
 */
import { TYPES, LED_COLORS, RGB_CH, BB_RAILS } from './constants';
import { clamp, ck, ard, pinPos } from './geometry';
import { sim } from './engineStore';

// Modules with their own VCC/GND that draw a small current and only work when powered.
const POWERED = new Set(['lcd', 'sonar', 'pir', 'dht', 'neopixel']);

function gauss(M, b, n) {
  for (let c = 0; c < n; c++) {
    let p = c;
    let best = Math.abs(M[c][c]);
    for (let r = c + 1; r < n; r++) {
      const v = Math.abs(M[r][c]);
      if (v > best) {
        best = v;
        p = r;
      }
    }
    if (best < 1e-18) continue;
    if (p !== c) {
      [M[p], M[c]] = [M[c], M[p]];
      [b[p], b[c]] = [b[c], b[p]];
    }
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      if (!f) continue;
      for (let k = c; k < n; k++) M[r][k] -= f * M[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = Math.abs(M[r][r]) < 1e-18 ? 0 : s / M[r][r];
  }
  return x;
}

const pinKeyOf = (doc, n) => ard(doc).id + '.' + (n < 14 ? 'D' + n : 'A' + (n - 14));
const pinName = (n) => (n < 14 ? 'pin ' + n : 'A' + (n - 14));

function holeMapFor(doc) {
  const m = new Map();
  for (const b of doc.parts) {
    if (b.type !== 'breadboard') continue;
    for (const pin in TYPES.breadboard.pins) {
      const [x, y] = pinPos(b, pin);
      m.set(ck(x, y), b.id + '.' + pin);
    }
  }
  return m;
}

/** Runs one MNA solve. Returns true if a change (e.g. LED burnout) means the caller should re-solve. */
function solveOnce(doc, finalPass, log) {
  if (!sim.running) {
    sim.volt = () => 0;
    sim.node = () => -1;
    sim.ledB = {};
    sim.buzz = {};
    sim.buzzFreq = 0;
    return false;
  }
  const P = doc.parts;
  const parent = new Map();
  const find = (k) => {
    while (parent.get(k) !== k) k = parent.get(k);
    return k;
  };
  const union = (a, b) => {
    if (!parent.has(a) || !parent.has(b)) return;
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const p of P) for (const pin in TYPES[p.type].pins) parent.set(p.id + '.' + pin, p.id + '.' + pin);
  for (const w of doc.wires) union(w.a, w.b);

  const holes = holeMapFor(doc);
  for (const b of P) {
    if (b.type !== 'breadboard') continue;
    const B = (pin) => b.id + '.' + pin;
    for (let c = 1; c <= 30; c++) {
      for (const r of 'bcde') union(B('a' + c), B(r + c));
      for (const r of 'ghij') union(B('f' + c), B(r + c));
    }
    for (const r in BB_RAILS) {
      let prev = null;
      for (let c = 1; c <= 30; c++) {
        if (c % 6) {
          if (prev) union(prev, B(r + c));
          prev = B(r + c);
        }
      }
    }
  }
  for (const q of P) {
    if (q.type === 'breadboard') continue;
    for (const pin in TYPES[q.type].pins) {
      const h = holes.get(ck(...pinPos(q, pin)));
      if (h) union(q.id + '.' + pin, h);
    }
  }

  const A = ard(doc);
  if (!A) return false;
  const AK = (pin) => A.id + '.' + pin;
  union(AK('GNDT'), AK('GND1'));
  union(AK('GND1'), AK('GND2'));
  const gnd = find(AK('GND1'));
  const idx = new Map();
  let n = 0;
  for (const k of parent.keys()) {
    const r = find(k);
    if (r !== gnd && !idx.has(r)) idx.set(r, n++);
  }
  const node = (k) => {
    if (!parent.has(k)) return -1;
    const r = find(k);
    return r === gnd ? -1 : idx.get(r);
  };

  const G = [];
  const I = [];
  const D = [];
  const src = (key, v, r) => {
    const a = node(key);
    if (a < 0) return;
    G.push([a, -1, 1 / r]);
    I.push([a, v / r]);
  };
  src(AK('5V'), 5, 0.1);
  src(AK('3V3'), 3.3, 0.1);
  for (let i = 0; i < 20; i++) {
    const st = sim.pins[i];
    if (st.mode === 'OUTPUT') src(pinKeyOf(doc, i), st.out, 25);
    else if (st.mode === 'INPUT_PULLUP') src(pinKeyOf(doc, i), 5, 20000);
  }

  for (const p of P) {
    const k = (pin) => node(p.id + '.' + pin);
    if (p.type === 'resistor') G.push([k('1'), k('2'), 1 / p.props.ohms]);
    else if (p.type === 'button' && p.pressed) G.push([k('1'), k('2'), 100]);
    else if (p.type === 'pot') {
      const pos = p.props.pos ?? 0.5;
      G.push([k('A'), k('W'), 1 / ((1 - pos) * 10000 + 1)]);
      G.push([k('W'), k('B'), 1 / (pos * 10000 + 1)]);
    } else if (p.type === 'joystick') {
      // Two potentiometers between VCC and GND (X, Y) and a button that pulls SW to GND.
      for (const [axis, pin] of [['x', 'VRX'], ['y', 'VRY']]) {
        const pos = p.props[axis] ?? 0.5;
        G.push([k('VCC'), k(pin), 1 / ((1 - pos) * 10000 + 1)]);
        G.push([k(pin), k('GND'), 1 / (pos * 10000 + 1)]);
      }
      if (p.pressed) G.push([k('SW'), k('GND'), 100]);
    } else if (p.type === 'buzzer') {
      G.push([k('P'), k('N'), 1 / 400]);
    } else if (POWERED.has(p.type)) {
      G.push([k('VCC'), k('GND'), 1 / 1000]);
      if (p.type === 'pir') src(p.id + '.OUT', p.triggered ? 5 : 0, 200);
    } else if (p.type === 'led' && !sim.burned[p.id]) {
      D.push({ a: k('A'), c: k('K'), vf: (LED_COLORS[p.props.color] || LED_COLORS.red).vf, rs: 15, id: p.id, on: !!sim.dOn[p.id], isLED: true });
    } else if (p.type === 'rgbled') {
      for (const chan in RGB_CH) {
        if (!sim.burned[p.id + ':' + chan]) {
          D.push({ a: k(chan), c: k('GND'), vf: RGB_CH[chan].vf, rs: 15, id: p.id + ':' + chan, on: !!sim.dOn[p.id + ':' + chan], isLED: true });
        }
      }
    } else if (p.type === 'diode' && !sim.burned[p.id]) {
      D.push({ a: k('A'), c: k('K'), vf: 0.7, rs: 10, id: p.id, on: !!sim.dOn[p.id], isLED: false });
    } else if (p.type === 'capacitor') {
      G.push([k('1'), k('2'), 1e-7]);
    } else if (p.type === 'toggle' && p.props.on) {
      G.push([k('1'), k('2'), 1 / 50]);
    } else if (p.type === 'ldr') {
      const oh = 1000 + (100 - clamp(p.props.light ?? 70, 0, 100)) * 2000;
      G.push([k('A'), k('B'), 1 / oh]);
    } else if (p.type === 'motor') {
      G.push([k('+'), k('-'), 1 / 30]);
    }
  }

  function solvePass(extra) {
    let V = new Float64Array(n);
    for (let it = 0; it < 40; it++) {
      const M = Array.from({ length: n }, () => new Float64Array(n));
      const b = new Float64Array(n);
      for (let i = 0; i < n; i++) M[i][i] += 1e-9;
      const stamp = (a, c, g) => {
        if (a >= 0) M[a][a] += g;
        if (c >= 0) M[c][c] += g;
        if (a >= 0 && c >= 0) {
          M[a][c] -= g;
          M[c][a] -= g;
        }
      };
      for (const [a, c, g] of G) stamp(a, c, g);
      for (const [a, c, g] of extra) stamp(a, c, g);
      for (const [a, cur] of I) b[a] += cur;
      for (const d of D) {
        if (d.on) {
          const g = 1 / d.rs;
          stamp(d.a, d.c, g);
          if (d.a >= 0) b[d.a] += g * d.vf;
          if (d.c >= 0) b[d.c] -= g * d.vf;
        } else {
          stamp(d.a, d.c, 1e-9);
        }
      }
      V = gauss(M, b, n);
      let changed = false;
      for (const d of D) {
        const vd = (d.a >= 0 ? V[d.a] : 0) - (d.c >= 0 ? V[d.c] : 0);
        if (!d.on && vd > d.vf + 1e-6) {
          d.on = true;
          changed = true;
        } else if (d.on && vd < d.vf - 1e-6) {
          d.on = false;
          changed = true;
        }
      }
      if (!changed) break;
    }
    return V;
  }

  let V = solvePass([]);
  const nv = (i) => (i >= 0 && i !== undefined ? V[i] : 0);

  const EX = [];
  for (const p of P) {
    const k = (pin) => node(p.id + '.' + pin);
    if (p.type === 'relay') {
      const on = nv(k('IN')) - nv(k('GND')) > 2.5;
      sim.relayOn[p.id] = on;
      EX.push(on ? [k('COM'), k('NO'), 1 / 5] : [k('COM'), k('NC'), 1 / 5]);
    } else if (p.type === 'transistor') {
      const on = nv(k('B')) - nv(k('E')) > 0.6;
      sim.transOn[p.id] = on;
      if (on) EX.push([k('C'), k('E'), 1 / 20]);
    }
  }
  if (EX.length) V = solvePass(EX);

  sim.volt = (key) => {
    const i = node(key);
    return i >= 0 ? V[i] : 0;
  };
  sim.node = node;

  let burnoutHappened = false;
  for (const d of D) {
    const vd = (d.a >= 0 ? V[d.a] : 0) - (d.c >= 0 ? V[d.c] : 0);
    const cur = d.on ? (vd - d.vf) / d.rs : 0;
    sim.ledB[d.id] = clamp(cur / 0.015, 0, 1);
    if (d.isLED && cur > 0.05 && !sim.burned[d.id]) {
      sim.burned[d.id] = true;
      log?.(`\u{1F4A5} ${d.id.split(':')[0]} burned out — too much current, add a resistor.`);
      burnoutHappened = true;
    }
    sim.dOn[d.id] = d.on;
  }

  if (finalPass) {
    for (let i = 0; i < 20; i++) {
      const st = sim.pins[i];
      if (st.mode !== 'OUTPUT') continue;
      const v = nv(node(pinKeyOf(doc, i)));
      const cur = Math.abs((st.out - v) / 25);
      if (cur > 0.041 && !sim.warned.has(i)) {
        sim.warned.add(i);
        log?.(`⚠️ Arduino ${pinName(i)} is drawing too much current (${Math.round(cur * 1000)}mA) — add a resistor in series.`);
      }
    }
  }

  for (const p of P) {
    const k = (pin) => node(p.id + '.' + pin);
    if (POWERED.has(p.type)) {
      const powered = nv(k('VCC')) - nv(k('GND')) > 4;
      if (p.type === 'lcd') {
        sim.lcdOn[p.id] = powered;
        sim.lcdI2C[p.id] = powered && node(p.id + '.SDA') === node(AK('A4')) && node(p.id + '.SCL') === node(AK('A5'));
      } else if (p.type === 'sonar') {
        sim.sonarOn[p.id] = powered;
      } else if (p.type === 'dht') {
        sim.dhtOn[p.id] = powered;
      } else if (p.type === 'neopixel') {
        let colors = [];
        for (let i = 0; i < 20; i++) {
          if (powered && sim.neoByPin[i] && node(pinKeyOf(doc, i)) === k('DIN')) colors = sim.neoByPin[i];
        }
        sim.neoColors[p.id] = colors;
      }
    } else if (p.type === 'motor') {
      sim.motorSpeed[p.id] = clamp(Math.abs(nv(k('+')) - nv(k('-'))) / 5, 0, 1);
    } else if (p.type === 'sevenseg') {
      const com = nv(k('COM'));
      const on = {};
      for (const seg of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp']) on[seg] = Math.abs(nv(k(seg)) - com) > 2.5;
      sim.segOn[p.id] = on;
    } else if (p.type === 'servo') {
      const sNode = k('S');
      let angle = 90;
      for (let i = 0; i < 20; i++) {
        if (sim.pins[i].mode === 'SERVO' && node(pinKeyOf(doc, i)) === sNode) {
          angle = sim.pins[i].servo ?? 90;
          break;
        }
      }
      sim.servoA[p.id] = angle;
    }
  }

  let anyBuzz = false;
  let buzzFreq = 0;
  for (const p of P) {
    if (p.type !== 'buzzer') continue;
    const on = nv(node(p.id + '.P')) - nv(node(p.id + '.N')) > 1.5;
    sim.buzz[p.id] = on;
    if (on) {
      anyBuzz = true;
      const pNode = node(p.id + '.P');
      for (let i = 0; i < 20; i++) {
        const st = sim.pins[i];
        if (st.mode === 'OUTPUT' && st.tone > 0 && node(pinKeyOf(doc, i)) === pNode) buzzFreq = Math.max(buzzFreq, st.tone);
      }
    }
  }
  sim.buzz.__any = anyBuzz;
  sim.buzzFreq = anyBuzz ? buzzFreq || 2300 : 0;

  return burnoutHappened;
}

/** Public entry point: re-solves up to 8 times (LED burnout changes topology), then returns. */
export function solveCircuit(doc, log) {
  for (let i = 0; i < 8; i++) {
    const again = solveOnce(doc, true, log);
    if (!again) break;
  }
}

export function resetSolverWarnings() {
  sim.warned = new Set();
}
