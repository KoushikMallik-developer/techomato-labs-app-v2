import { useMemo } from 'react';
import { DEFS, DRAW, setOcc, curve } from '@/features/editor/engine/svgParts';
import { partsBBox, occupiedSet, keyPos } from '@/features/editor/engine/geometry';
import { LED_COLORS } from '@/features/editor/engine/constants';

/** Extra markup layered on top of a part's normal (idle) render for a
 * purely decorative "running" look — used only where a caller passes
 * `liveGlow`, e.g. the landing page hero. Never touches the shared `sim`
 * singleton, so it can't affect any other CircuitThumbnail on the page. */
function liveOverlay(p) {
  if (p.type === 'led') {
    const fill = (LED_COLORS[p.props.color] || LED_COLORS.red).fill;
    return `<circle cx="0" cy="-8" r="28" fill="url(#glow-${p.props.color})" opacity=".9"/>
<path d="M-10 1V-8A10 10 0 0 1 10 -8V1Z" fill="${fill}"/>
<rect x="-12" y="0" width="24" height="4" rx="1.5" fill="${fill}"/>
<circle cx="0" cy="-6" r="4" fill="#fff" opacity=".55"/>`;
  }
  if (p.type === 'buzzer') {
    return `<g stroke="#ffd166" stroke-width="2" fill="none" stroke-linecap="round"><path d="M23 -12A14 14 0 0 1 23 8"/><path d="M29 -17A21 21 0 0 1 29 13" opacity=".6"/></g>`;
  }
  return '';
}

/**
 * Static, non-interactive render of a circuit — reuses the exact same
 * DRAW{} SVG builders the live editor board uses (svgParts.js), so a card's
 * thumbnail always matches what the circuit actually looks like open in the
 * editor. `sim` is never touched here, so parts render in their idle state.
 *
 * `liveGlow` is an optional { [partId]: boolean } map for a purely visual
 * "lit up" overlay on top of the idle render — opt-in, so every other
 * caller (gallery cards, dashboard) is unaffected.
 */
export default function CircuitThumbnail({ parts, wires, className = '', liveGlow }) {
  const { viewBox, markup } = useMemo(() => {
    if (!parts || parts.length === 0) return { viewBox: '0 0 300 200', markup: '' };
    const doc = { parts, wires: wires || [] };
    setOcc(occupiedSet(doc));
    const order = [...parts].sort((a, b) => (b.type === 'breadboard') - (a.type === 'breadboard'));
    let out = DEFS;
    for (const p of order) {
      const glow = liveGlow?.[p.id] ? liveOverlay(p) : '';
      out += `<g transform="translate(${p.x} ${p.y}) rotate(${p.rot || 0})">${DRAW[p.type](p)}${glow}</g>`;
    }
    for (const w of doc.wires) {
      const a = keyPos(doc, w.a);
      const b = keyPos(doc, w.b);
      if (!a || !b) continue;
      out += `<path d="${curve(a, b)}" stroke="${w.color}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
    const [x0, y0, x1, y1] = partsBBox(doc);
    const pad = 24;
    return {
      viewBox: `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`,
      markup: out,
    };
  }, [parts, wires, liveGlow]);

  return (
    <svg
      className={`circuit-thumb ${className}`}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Circuit preview"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
