import { TYPES } from './constants';
import {
  clamp, byId, keyPos, occupiedSet, snapPartPos, carryFor, partsBBox, pinLabel, pinPos, esc,
} from './geometry';
import { DEFS, DRAW, setOcc, curve } from './svgParts';
import { sim } from './engineStore';

/**
 * Framework-agnostic 2D board engine: owns the SVG's innerHTML, all
 * pointer/drag/wire/pan/zoom interaction, and its own working copy of
 * {parts, wires} so drag gestures render at full pointer rate without ever
 * touching Redux. React only sees the discrete results (a part's final
 * position after a drag, a completed wire, a selection change) via the
 * callbacks passed to create().
 */
export function createBoardEngine(svgEl, callbacks) {
  const doc = { parts: [], wires: [] };
  let running = false;
  let sel = null; // { kind: 'part' | 'wire', id }
  let pending = null; // pin key string
  let pointerWorld = null;
  let drag = null;
  let fitted = false;
  let dirty = false;
  const ptrs = new Map();
  let vb = { x: 0, y: 0, w: 600, h: 400 };
  let ro = null;

  function cloneDoc(parts, wires) {
    return {
      parts: parts.map((p) => ({ ...p, props: { ...p.props } })),
      wires: wires.map((w) => ({ ...w })),
    };
  }

  /** Called by React whenever the Redux-held document changes. Skipped for
   * parts/wires while a drag is in flight so we never clobber a live gesture. */
  function setDoc({ parts, wires, running: nextRunning }) {
    if (!drag || drag.mode === 'pan' || drag.mode === 'pinch') {
      if (parts) doc.parts = cloneDoc(parts, doc.wires).parts;
      if (wires) doc.wires = cloneDoc(doc.parts, wires).wires;
    }
    if (nextRunning !== undefined) running = nextRunning;
    schedule();
  }

  function schedule() {
    if (dirty) return;
    dirty = true;
    requestAnimationFrame(() => {
      dirty = false;
      render();
    });
  }

  function applyVB() {
    svgEl.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  }

  function viewInsets(r) {
    const ins = { l: 0, t: 0, r: 0, b: 0 };
    const root = svgEl.closest('.editor-app') || document;
    for (const sel_ of ['.editor-hud', '.editor-dock', '.editor-console']) {
      const e = root.querySelector(sel_);
      if (!e) continue;
      const q = e.getBoundingClientRect();
      if (!q.width || !q.height) continue;
      if (q.width > r.width * 0.6) {
        if (q.top + q.height / 2 < r.top + r.height / 2) ins.t = Math.max(ins.t, q.bottom - r.top);
        else ins.b = Math.max(ins.b, r.bottom - q.top);
      } else if (q.left + q.width / 2 < r.left + r.width / 2) ins.l = Math.max(ins.l, q.right - r.left);
      else ins.r = Math.max(ins.r, r.right - q.left);
    }
    ins.b += 44;
    return ins;
  }

  function fitView() {
    const r = svgEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const [x0, y0, x1, y1] = partsBBox(doc);
    const ins = viewInsets(r);
    const pad = 16;
    const aw = Math.max(80, r.width - ins.l - ins.r - pad * 2);
    const ah = Math.max(80, r.height - ins.t - ins.b - pad * 2);
    const k = Math.max((x1 - x0) / aw, (y1 - y0) / ah, 0.1);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    vb = {
      w: r.width * k,
      h: r.height * k,
      x: cx - (ins.l + pad + aw / 2) * k,
      y: cy - (ins.t + pad + ah / 2) * k,
    };
    applyVB();
    fitted = true;
  }

  function zoomAt(f, wx, wy) {
    const nw = clamp(vb.w * f, 120, 4000);
    const k = nw / vb.w;
    vb.x = wx - (wx - vb.x) * k;
    vb.y = wy - (wy - vb.y) * k;
    vb.w = nw;
    vb.h *= k;
    applyVB();
  }

  function toWorld(e) {
    const m = svgEl.getScreenCTM();
    if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x, p.y];
  }

  function render() {
    const occ = occupiedSet(doc);
    setOcc(occ);
    const order = [...doc.parts].sort((a, b) => (b.type === 'breadboard') - (a.type === 'breadboard'));
    let out = DEFS + '<rect x="-6000" y="-6000" width="12000" height="12000" fill="url(#grid)"/>';
    for (const p of order) {
      const isSel = sel && sel.kind === 'part' && sel.id === p.id;
      let box = '';
      if (isSel) {
        const [x, y, w, h] = TYPES[p.type].box;
        box = `<rect x="${x - 4}" y="${y - 4}" width="${w + 8}" height="${h + 8}" rx="7" fill="none" style="stroke:var(--accent)" stroke-width="1.6" stroke-dasharray="5 4"/>`;
      }
      out += `<g class="part" data-part="${p.id}" transform="translate(${p.x} ${p.y}) rotate(${p.rot || 0})">${DRAW[p.type](p)}${box}</g>`;
    }
    for (const w of doc.wires) {
      const a = keyPos(doc, w.a);
      const b = keyPos(doc, w.b);
      if (!a || !b) continue;
      const d = curve(a, b);
      const isSel = sel && sel.kind === 'wire' && sel.id === w.id;
      out += `<g class="wire" data-wire="${w.id}"><path d="${d}" stroke="transparent" stroke-width="12" fill="none"/>${
        isSel ? `<path d="${d}" style="stroke:var(--accent)" stroke-opacity=".4" stroke-width="8" fill="none" stroke-linecap="round"/>` : ''
      }<path d="${d}" stroke="${w.color}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="${a[0]}" cy="${a[1]}" r="3" fill="${w.color}"/><circle cx="${b[0]}" cy="${b[1]}" r="3" fill="${w.color}"/></g>`;
    }
    if (!running) {
      for (const p of order) {
        for (const pin in TYPES[p.type].pins) {
          const k = p.id + '.' + pin;
          const [x, y] = pinPos(p, pin);
          const bb = p.type === 'breadboard';
          out += `<g class="pin${pending === k ? ' pending' : ''}" data-pin="${k}"><title>${esc(pinLabel(doc, k))}</title>${
            p.type !== 'arduino' && !bb ? `<circle cx="${x}" cy="${y}" r="2.6" fill="#c3c9d0"/>` : ''
          }<circle class="ring" cx="${x}" cy="${y}" r="${bb ? 4.5 : 5.5}" fill="none" style="stroke:var(--accent)" stroke-width="2"/><circle cx="${x}" cy="${y}" r="${bb ? 4.6 : 8}" fill="transparent"/></g>`;
        }
      }
    }
    if (pending && pointerWorld) {
      const a = keyPos(doc, pending);
      if (a) out += `<line x1="${a[0]}" y1="${a[1]}" x2="${pointerWorld[0]}" y2="${pointerWorld[1]}" style="stroke:var(--accent)" stroke-width="2" stroke-dasharray="5 4" pointer-events="none"/>`;
    }
    svgEl.innerHTML = out;
    svgEl.classList.toggle('running', running);
    callbacks.onStatus?.(statusText());
  }

  function statusText() {
    if (running) return 'Running. Press the button, turn the knob, or drag the ultrasonic sensor to change the distance.';
    if (pending) return `Wiring from ${pinLabel(doc, pending)}. Tap another pin to connect, or the same pin to cancel.`;
    if (sel && sel.kind === 'part') {
      const p = byId(doc, sel.id);
      if (p) return TYPES[p.type].label + ' selected. Drag to move it.';
    }
    if (sel) return 'Wire selected.';
    return 'Tap a pin, then another pin, to add a wire. Drag parts to move them.';
  }

  function setSelection(next) {
    sel = next;
    pending = null;
    callbacks.onSelectionChange?.(sel);
  }
  function tapPin(k, w) {
    // Deselect any wire/part without going through setSelection(), which
    // also clears `pending` — that would wipe out the very state this
    // function is about to read, making "tap a second pin to connect"
    // and "tap the same pin to cancel" unreachable.
    sel = null;
    callbacks.onSelectionChange?.(null);
    if (!pending) {
      pending = k;
      pointerWorld = w;
    } else if (pending === k) {
      pending = null;
    } else {
      const a = pending;
      pending = null;
      if (a !== k) callbacks.onAddWire?.(a, k);
    }
    schedule();
  }

  function deleteSelected() {
    if (!sel || running) return;
    if (sel.kind === 'wire') {
      callbacks.onDeleteWire?.(sel.id);
    } else {
      const p = byId(doc, sel.id);
      if (!p || p.type === 'arduino') return;
      callbacks.onDeletePart?.(sel.id);
    }
    sel = null;
  }

  function startPinch() {
    const [a, b] = [...ptrs.values()];
    const r = svgEl.getBoundingClientRect();
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    drag = {
      mode: 'pinch',
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      w0: vb.w,
      h0: vb.h,
      wx: vb.x + ((cx - r.left) / r.width) * vb.w,
      wy: vb.y + ((cy - r.top) / r.height) * vb.h,
    };
  }
  function doPinch() {
    const [a, b] = [...ptrs.values()];
    if (!b) return;
    const r = svgEl.getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const nw = clamp((drag.w0 * drag.d0) / d, 120, 4000);
    const nh = (nw * drag.h0) / drag.w0;
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    vb = { w: nw, h: nh, x: drag.wx - ((cx - r.left) / r.width) * nw, y: drag.wy - ((cy - r.top) / r.height) * nh };
    applyVB();
  }

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try {
      svgEl.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) return startPinch();
    if (ptrs.size > 2) return;
    const w = toWorld(e);
    const pinEl = e.target.closest('[data-pin]');
    const wireEl = e.target.closest('[data-wire]');
    const ctlEl = e.target.closest('[data-ctl]');
    const partEl = e.target.closest('[data-part]');
    const pan = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: vb.x, vy: vb.y, moved: false };
    if (running) {
      if (ctlEl && partEl) {
        const p = byId(doc, partEl.dataset.part);
        if (p.type === 'button') {
          p.pressed = true;
          drag = { mode: 'button', part: p };
          callbacks.onLiveResolve?.();
        } else if (p.type === 'pot') {
          drag = { mode: 'pot', part: p, lx: w[0], ly: w[1] };
        } else if (p.type === 'sonar') {
          drag = { mode: 'sonar', part: p, lx: w[0], ly: w[1] };
        } else if (p.type === 'ldr') {
          drag = { mode: 'ldr', part: p, lx: w[0], ly: w[1] };
        } else if (p.type === 'dht') {
          drag = { mode: 'dht', part: p, lx: w[0], ly: w[1] };
        } else if (p.type === 'joystick') {
          drag = { mode: 'joystick', part: p, sx: w[0], sy: w[1], moved: false };
        } else if (p.type === 'toggle') {
          p.props.on = !p.props.on;
          callbacks.onSetPartProp?.(p.id, 'on', p.props.on);
          callbacks.onLiveResolve?.();
        } else if (p.type === 'pir') {
          p.triggered = true;
          callbacks.onLiveResolve?.();
          clearTimeout(p._pirT);
          p._pirT = setTimeout(() => {
            p.triggered = false;
            callbacks.onLiveResolve?.();
          }, 1800);
        }
        return;
      }
      drag = pan;
      return;
    }
    if (pinEl) {
      tapPin(pinEl.dataset.pin, w);
      drag = null;
      return;
    }
    if (wireEl) {
      setSelection({ kind: 'wire', id: wireEl.dataset.wire });
      schedule();
      return;
    }
    if (partEl) {
      const p = byId(doc, partEl.dataset.part);
      setSelection({ kind: 'part', id: p.id });
      drag = { mode: 'part', part: p, ox: w[0] - p.x, oy: w[1] - p.y, moved: false, carry: carryFor(doc, p) };
      schedule();
      return;
    }
    drag = pan;
  }

  function onPointerMove(e) {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (drag && drag.mode === 'pinch') return doPinch();
    const w = toWorld(e);
    if (pending) {
      pointerWorld = w;
      schedule();
    }
    if (!drag) return;
    if (drag.mode === 'part') {
      const [nx, ny] = snapPartPos(drag.part, w[0] - drag.ox, w[1] - drag.oy);
      if (nx !== drag.part.x || ny !== drag.part.y) {
        drag.part.x = nx;
        drag.part.y = ny;
        drag.moved = true;
        for (const c of drag.carry) {
          c.part.x = nx + c.dx;
          c.part.y = ny + c.dy;
        }
        schedule();
      }
    } else if (drag.mode === 'pan') {
      const k = vb.w / svgEl.clientWidth;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (Math.hypot(dx, dy) > 4) drag.moved = true;
      vb.x = drag.vx - dx * k;
      vb.y = drag.vy - dy * k;
      applyVB();
    } else if (drag.mode === 'pot') {
      const d = (w[0] - drag.lx - (w[1] - drag.ly)) / 90;
      drag.lx = w[0];
      drag.ly = w[1];
      drag.part.props.pos = clamp((drag.part.props.pos ?? 0.5) + d, 0, 1);
      callbacks.onLiveResolve?.();
    } else if (drag.mode === 'sonar') {
      const d = (w[0] - drag.lx - (w[1] - drag.ly)) * 1.2;
      drag.lx = w[0];
      drag.ly = w[1];
      drag.part.props.cm = clamp((drag.part.props.cm ?? 50) + d, 2, 400);
      schedule();
    } else if (drag.mode === 'ldr') {
      const d = (w[0] - drag.lx - (w[1] - drag.ly)) * 0.6;
      drag.lx = w[0];
      drag.ly = w[1];
      drag.part.props.light = clamp((drag.part.props.light ?? 70) + d, 0, 100);
      callbacks.onLiveResolve?.();
    } else if (drag.mode === 'dht') {
      const d = (w[0] - drag.lx - (w[1] - drag.ly)) * 0.3;
      drag.lx = w[0];
      drag.ly = w[1];
      drag.part.props.temp = Math.round(clamp((drag.part.props.temp ?? 24) + d, -40, 80) * 10) / 10;
      schedule();
    } else if (drag.mode === 'joystick') {
      // shortcut: the stick follows the pointer in screen axes, ignoring the part's rotation.
      const dx = w[0] - drag.sx;
      const dy = w[1] - drag.sy;
      if (Math.hypot(dx, dy) > 2) drag.moved = true;
      drag.part.props.x = clamp(0.5 + dx / 40, 0, 1);
      drag.part.props.y = clamp(0.5 + dy / 40, 0, 1);
      callbacks.onLiveResolve?.();
    }
  }

  function onPointerUp(e) {
    ptrs.delete(e.pointerId);
    if (!drag) return;
    if (drag.mode === 'pinch') {
      if (ptrs.size < 2) drag = null;
      return;
    }
    if (drag.mode === 'button') {
      drag.part.pressed = false;
      callbacks.onLiveResolve?.();
    }
    if (drag.mode === 'part' && drag.moved) callbacks.onMovePart?.(drag.part.id, drag.part.x, drag.part.y);
    if (drag.mode === 'pot') callbacks.onSetPartProp?.(drag.part.id, 'pos', drag.part.props.pos);
    if (drag.mode === 'sonar') callbacks.onSetPartProp?.(drag.part.id, 'cm', drag.part.props.cm);
    if (drag.mode === 'ldr') callbacks.onSetPartProp?.(drag.part.id, 'light', drag.part.props.light);
    if (drag.mode === 'dht') callbacks.onSetPartProp?.(drag.part.id, 'temp', drag.part.props.temp);
    if (drag.mode === 'joystick') {
      // A real stick springs back to the middle; a tap without moving presses its button.
      const part = drag.part;
      part.props.x = 0.5;
      part.props.y = 0.5;
      if (!drag.moved) {
        part.pressed = true;
        setTimeout(() => {
          part.pressed = false;
          callbacks.onLiveResolve?.();
        }, 300);
      }
      callbacks.onLiveResolve?.();
    }
    if (drag.mode === 'pan' && !drag.moved && !running) {
      pending = null;
      setSelection(null);
      schedule();
    }
    drag = null;
  }

  function onWheel(e) {
    e.preventDefault();
    const [x, y] = toWorld(e);
    zoomAt(Math.exp(e.deltaY * 0.0015), x, y);
  }

  function onKeyDown(e) {
    if (e.target.closest && e.target.closest('textarea,select,input')) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelected();
      schedule();
      e.preventDefault();
    }
    if (e.key === 'Escape') {
      pending = null;
      setSelection(null);
      schedule();
    }
  }

  function addPartAtViewCenter(type) {
    const def = TYPES[type];
    const [bx, by, bw, bh] = def.box;
    const cx = vb.x + vb.w / 2;
    const cy = vb.y + vb.h / 2;
    const tmp = { type, rot: 0 };
    const [x, y] = snapPartPos(tmp, cx - (bx + bw / 2), cy - (by + bh / 2));
    callbacks.onAddPart?.(type, x, y);
  }

  function mount() {
    svgEl.addEventListener('pointerdown', onPointerDown);
    svgEl.addEventListener('pointermove', onPointerMove);
    svgEl.addEventListener('pointerup', onPointerUp);
    svgEl.addEventListener('pointercancel', onPointerUp);
    svgEl.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('keydown', onKeyDown);
    ro = new ResizeObserver(() => {
      const r = svgEl.getBoundingClientRect();
      if (!r.width || !r.height) return;
      if (!fitted) return fitView();
      const cy = vb.y + vb.h / 2;
      vb.h = (vb.w * r.height) / r.width;
      vb.y = cy - vb.h / 2;
      applyVB();
    });
    ro.observe(svgEl);
    schedule();
  }

  function unmount() {
    svgEl.removeEventListener('pointerdown', onPointerDown);
    svgEl.removeEventListener('pointermove', onPointerMove);
    svgEl.removeEventListener('pointerup', onPointerUp);
    svgEl.removeEventListener('pointercancel', onPointerUp);
    svgEl.removeEventListener('wheel', onWheel);
    document.removeEventListener('keydown', onKeyDown);
    ro?.disconnect();
  }

  return {
    mount,
    unmount,
    setDoc,
    fitView,
    zoomIn: () => {
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      zoomAt(1 / 1.25, cx, cy);
    },
    zoomOut: () => {
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      zoomAt(1.25, cx, cy);
    },
    addPartAtViewCenter,
    deleteSelected: () => {
      deleteSelected();
      schedule();
    },
    rotateSelected: () => {
      if (!sel || sel.kind !== 'part') return;
      const p = byId(doc, sel.id);
      if (!p) return;
      callbacks.onRotatePart?.(p.id);
    },
    getSim: () => sim,
    getDoc: () => doc,
    requestRender: schedule,
  };
}
