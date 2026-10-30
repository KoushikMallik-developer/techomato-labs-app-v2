import { TYPES } from '@/features/editor/engine/constants';

// Circuits come from other users (gallery, remix, import) and the editor builds SVG markup by string
// concatenation, so anything that reaches that markup must be a plain number or a harmless token.
const TOKEN = /^[\w.-]{1,40}$/;
const PROP_TEXT = /^[\w .#-]{0,32}$/;
const HEX = /^#[0-9a-f]{3,8}$/i;
const num = (v) => (Number.isFinite(v) ? v : 0);

function cleanProps(props) {
  const out = {};
  for (const [k, v] of Object.entries(props && typeof props === 'object' ? props : {})) {
    if (!TOKEN.test(k)) continue;
    if (typeof v === 'boolean' || Number.isFinite(v) || (typeof v === 'string' && PROP_TEXT.test(v))) out[k] = v;
  }
  return out;
}

/** Drops anything that is not a well-formed part/wire so a hostile circuit cannot inject markup. */
export function sanitizeCircuit(parts, wires) {
  const cleanParts = (Array.isArray(parts) ? parts : [])
    .filter((p) => p && typeof p.id === 'string' && TOKEN.test(p.id) && Object.hasOwn(TYPES, p.type))
    .map((p) => ({ ...p, x: num(p.x), y: num(p.y), rot: num(p.rot), props: cleanProps(p.props) }));
  const cleanWires = (Array.isArray(wires) ? wires : [])
    .filter((w) => w && [w.id, w.a, w.b].every((s) => typeof s === 'string' && TOKEN.test(s)))
    .map((w) => ({ ...w, color: HEX.test(w.color) ? w.color : '#ffd166' }));
  return { parts: cleanParts, wires: cleanWires };
}
