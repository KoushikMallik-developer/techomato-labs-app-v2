import { TYPES, ARD_LABELS, RAIL_NAMES, PIN_NAMES, BB_PINS } from './constants';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const snap = (v) => Math.round(v / 5) * 5;
export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const ck = (x, y) => Math.round(x) + ',' + Math.round(y);

export const byId = (doc, id) => doc.parts.find((p) => p.id === id);
export const ard = (doc) => doc.parts.find((p) => p.type === 'arduino');

export function local2world(p, lx, ly) {
  const r = ((p.rot || 0) * Math.PI) / 180;
  const c = Math.round(Math.cos(r));
  const s = Math.round(Math.sin(r));
  return [p.x + lx * c - ly * s, p.y + lx * s + ly * c];
}

export function pinPos(p, pin) {
  return local2world(p, ...TYPES[p.type].pins[pin]);
}

export function keyPos(doc, k) {
  const [id, pin] = k.split('.');
  const p = byId(doc, id);
  return p && TYPES[p.type].pins[pin] ? pinPos(p, pin) : null;
}

export function holeMap(doc) {
  const m = new Map();
  for (const b of doc.parts) {
    if (b.type !== 'breadboard') continue;
    for (const pin in BB_PINS) {
      const [x, y] = pinPos(b, pin);
      m.set(ck(x, y), b.id + '.' + pin);
    }
  }
  return m;
}

export function occupiedSet(doc) {
  const o = new Set();
  for (const p of doc.parts) {
    if (p.type === 'breadboard' || p.type === 'arduino') continue;
    for (const pin in TYPES[p.type].pins) {
      const [x, y] = pinPos(p, pin);
      o.add(ck(x, y));
    }
  }
  return o;
}

export function snapPartPos(p, x, y) {
  if (p.type === 'arduino') return [snap(x), snap(y)];
  if (p.type === 'breadboard') return [Math.round(x / 10) * 10, Math.round(y / 10) * 10];
  const first = Object.keys(TYPES[p.type].pins)[0];
  const [fx, fy] = local2world({ x: 0, y: 0, rot: p.rot }, ...TYPES[p.type].pins[first]);
  return [Math.round((x + fx) / 10) * 10 - fx, Math.round((y + fy) / 10) * 10 - fy];
}

/** When you drag a breadboard, any part seated in its holes moves with it. */
export function carryFor(doc, p) {
  const out = [];
  if (p.type !== 'breadboard') return out;
  const holes = new Set(Object.keys(BB_PINS).map((pin) => ck(...pinPos(p, pin))));
  for (const q of doc.parts) {
    if (q.type === 'breadboard' || q.type === 'arduino') continue;
    if (Object.keys(TYPES[q.type].pins).some((pin) => holes.has(ck(...pinPos(q, pin))))) {
      out.push({ part: q, dx: q.x - p.x, dy: q.y - p.y });
    }
  }
  return out;
}

export function partsBBox(doc) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of doc.parts) {
    const [bx, by, bw, bh] = TYPES[p.type].box;
    for (const [lx, ly] of [
      [bx, by],
      [bx + bw, by],
      [bx, by + bh],
      [bx + bw, by + bh],
    ]) {
      const [x, y] = local2world(p, lx, ly);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  if (!Number.isFinite(x0)) return [0, 0, 300, 200];
  return [x0, y0, x1, y1];
}

export function pinLabel(doc, k) {
  const [id, pin] = k.split('.');
  const p = byId(doc, id);
  if (!p) return k;
  if (p.type === 'arduino') return 'Arduino ' + (/^D\d/.test(pin) ? 'pin ' + pin.slice(1) : ARD_LABELS[pin]);
  if (p.type === 'breadboard') {
    const r = pin.slice(0, 2);
    return 'Breadboard ' + (RAIL_NAMES[r] || 'hole ' + pin);
  }
  return TYPES[p.type].label + ' ' + PIN_NAMES[p.type][pin];
}
