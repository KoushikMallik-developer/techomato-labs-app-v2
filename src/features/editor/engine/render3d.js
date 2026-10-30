/**
 * 3D board view. Reads the same document/sim state as the 2D board
 * (draw2d/board.js) and now mirrors most of its editing/interaction model
 * rather than being a pure viewer:
 *  - stopped: click a part to select it (Inspector works off the same
 *    selection state as 2D), drag a part to reposition it, click a pin
 *    then another pin to wire them, click a wire to select/delete it.
 *  - running: drag a live-sim control (sonar wall, potentiometer knob,
 *    LDR panel) to adjust its reading, press the button, flip the toggle,
 *    or tap the PIR dome — same gestures 2D supports, via
 *    `setupDragInteraction()` below.
 * Breadboard/Arduino top faces reuse the exact same 2D SVG markup
 * (svgParts.js) rasterized to a canvas texture, so their silkscreen
 * labels/pin layout always match the 2D board exactly. Component
 * shapes/materials below mirror the original prototype's 3D component
 * library so both views feel like the same product.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TYPES, LED_COLORS, BAND } from './constants';
import { partsBBox, local2world, snapPartPos, carryFor, pinPos, pinLabel } from './geometry';
import { DRAW } from './svgParts';
import { sim } from './engineStore';

const Y = {
  breadboard: 4,
  arduino: 5,
};

function svgTexture(svgInner, w, h, onReady, bg = '#eef0f2') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${svgInner}</svg>`;
  const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  const tex = new THREE.Texture();
  const img = new Image();
  img.onload = () => {
    tex.image = img;
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    onReady?.();
  };
  img.src = url;
  return tex;
}

function standard(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...extra });
}

/**
 * A flat slab with actually-rounded corners (matching the silkscreen's
 * rx="10" board outline), centered on X/Z and laid flat with its top face
 * at y=+depth/2. Used instead of a sharp-cornered BoxGeometry so the mesh's
 * own silhouette follows the rounded PCB edge — a plain box painted with a
 * matching background color still has hard square corners, which show as a
 * mismatched patch against the ground at grazing angles.
 */
function roundedSlabGeometry(w, h, depth, r) {
  const hw = w / 2;
  const hh = h / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, depth / 2, 0);
  return geo;
}

/** A soft radial-gradient sprite texture, shared by every LED's glow halo. */
let glowTexture = null;
function glowTex() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

export function createBoard3D(container, callbacks) {
  const doc = { parts: [], wires: [] };
  let renderer;
  let scene;
  let camera;
  let controls;
  let group;
  let raf = null;
  let ro = null;
  let layoutSig = '';
  let fitted = false;
  let wasRunning = false;
  const dyn = [];
  // Interactive live-sim controls (sonar wall, pot knob, ldr panel, toggle,
  // button, pir dome) — rebuilt each build(), read by the pointer handlers
  // set up in init(). Keyed by partId; each mesh also carries
  // `userData.partId` so a raycast hit can be mapped back to its entry.
  const draggables = new Map();
  let dragState = null;
  // Pin markers (edit mode only) and the pending "wiring from this pin"
  // state, plus the current selection — both mirror 2D's board.js state.
  const pins = new Map();
  let pinsGroup;
  let pending = null;
  let sel = null;
  let hoverPin = null;
  let accentColor;
  // Per-part cache of the last-baked SVG string + texture for the
  // arduino/breadboard top faces. Repositioning any part changes `sig()`
  // (it includes every part's x/y) and forces a full rebuild every drag
  // frame; without this, that rebuild would re-rasterize these textures
  // from scratch every frame even though their actual artwork didn't
  // change, which briefly shows a blank texture each time (the same
  // flicker bug fixed for the sonar's periodic re-bake).
  const texCache = new Map();

  /**
   * Merges incoming parts into the existing ones *in place* (by id) rather
   * than replacing them with fresh clones. Built meshes keep a closure over
   * their part object (see `dyn` in each BUILD3 builder), and since a
   * layout-only `sig()` doesn't fire a rebuild for prop-only changes (e.g.
   * the sonar's `cm`), those closures need the identity to survive across
   * every `setDoc` call — a wholesale replace here would silently orphan
   * them, freezing their visuals at whatever value they had at the last
   * rebuild even though the doc (and Redux) had already moved on.
   */
  function setDoc({ parts, wires }) {
    if (parts) {
      const existing = new Map(doc.parts.map((p) => [p.id, p]));
      doc.parts = parts.map((p) => {
        const prev = existing.get(p.id);
        if (!prev) return { ...p, props: { ...p.props } };
        prev.x = p.x;
        prev.y = p.y;
        prev.rot = p.rot;
        prev.props = { ...p.props };
        return prev;
      });
    }
    if (wires) doc.wires = wires.map((w) => ({ ...w }));
  }

  function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = false;
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(38, 1, 2, 20000);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x40584e, 0.85));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(-300, 800, 500);
    scene.add(dir);

    // Theme-aware tiled "cutting mat" ground, matching the app's current
    // dark-panel canvas tokens rather than a hardcoded color.
    const css = getComputedStyle(document.documentElement);
    const matC = css.getPropertyValue('--canvas').trim() || '#17181c';
    const gridC = css.getPropertyValue('--grid-major').trim() || 'rgba(255,255,255,.13)';
    accentColor = new THREE.Color(css.getPropertyValue('--accent').trim() || '#c8381f');
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const cx = cv.getContext('2d');
    cx.fillStyle = matC;
    cx.fillRect(0, 0, 64, 64);
    cx.strokeStyle = gridC;
    cx.lineWidth = 3;
    cx.strokeRect(0, 0, 64, 64);
    const groundTex = new THREE.CanvasTexture(cv);
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(300, 300);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.maxPolarAngle = Math.PI / 2.08;
    controls.screenSpacePanning = true;
    controls.minDistance = 60;
    controls.maxDistance = 2200;

    group = new THREE.Group();
    scene.add(group);
    pinsGroup = new THREE.Group();
    scene.add(pinsGroup);

    setupDragInteraction();
    document.addEventListener('keydown', onKeyDown);

    ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();
    // Schedule rather than call synchronously: the caller sets the initial
    // doc (setDoc) right after createBoard3D() returns, and that must land
    // before the first build()/fit() runs — otherwise fit() measures the
    // still-empty placeholder doc and locks onto a too-tight camera frame.
    raf = requestAnimationFrame(loop);
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function statusText() {
    if (sim.running) return 'Running. Press the button, turn the knob, or drag the sonar wall to change its reading.';
    if (pending) return `Wiring from ${pinLabel(doc, pending)}. Click another pin to connect, or the same pin to cancel.`;
    if (sel && sel.kind === 'part') {
      const p = doc.parts.find((x) => x.id === sel.id);
      if (p) return TYPES[p.type].label + ' selected — drag to move, or use the Inspector to rotate/delete.';
    }
    if (sel) return 'Wire selected — use the Inspector to delete it.';
    return 'Click a pin, then another pin, to add a wire. Drag parts to move them, or orbit to look around.';
  }

  function updateStatus() {
    callbacks?.onStatus?.(statusText());
  }

  function setSelection(next) {
    sel = next;
    pending = null;
    callbacks?.onSelectionChange?.(sel);
    updateStatus();
  }

  function tapPin(key) {
    // Deselect without going through setSelection(), which also clears
    // `pending` — that would wipe the very state this function reads next,
    // making "click a second pin to connect" and "click the same pin to
    // cancel" unreachable.
    sel = null;
    callbacks?.onSelectionChange?.(null);
    if (!pending) pending = key;
    else if (pending === key) pending = null;
    else {
      const a = pending;
      pending = null;
      if (a !== key) callbacks?.onAddWire?.(a, key);
    }
    refreshPins();
    updateStatus();
  }

  function deleteSelected() {
    if (sim.running || !sel) return;
    if (sel.kind === 'wire') {
      callbacks?.onDeleteWire?.(sel.id);
    } else {
      const p = doc.parts.find((x) => x.id === sel.id);
      if (!p || p.type === 'arduino') return;
      callbacks?.onDeletePart?.(sel.id);
    }
    sel = null;
    callbacks?.onSelectionChange?.(null);
  }

  function onKeyDown(e) {
    if (e.target.closest && e.target.closest('textarea,select,input')) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteSelected();
      e.preventDefault();
    }
    if (e.key === 'Escape') {
      pending = null;
      setSelection(null);
    }
  }

  /**
   * Mirrors 2D's exact pin markup (board.js's render()): a small solid
   * leg-tip dot for ordinary components, nothing visible at all for
   * arduino/breadboard pins, and an accent-colored ring that's normally
   * hidden (opacity 0, like 2D's `.ring { opacity: 0 }`) and only fades in
   * on hover or while it's the pending wire's start pin.
   */
  function buildPins() {
    for (const p of doc.parts) {
      const bb = p.type === 'breadboard';
      const ard = p.type === 'arduino';
      for (const pin in TYPES[p.type].pins) {
        const key = `${p.id}.${pin}`;
        const [wx, wy] = pinPos(p, pin);
        // +6 (the same height wires attach at) lands exactly on top of the
        // arduino's own header-bar meshes (they sit at y 3..11 and this
        // part's heightAt() is 5), z-fighting a same-height opaque box and
        // losing every time. +11 clears that with margin, and only makes
        // pins on other parts float a little higher above their own body.
        const py = heightAt(p) + 11;

        // The actual click/hover target — bigger than what's drawn, same
        // as 2D's separate invisible `r="8"`/`r="4.6"` hit-circle.
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(bb ? 4.2 : 6.5, 8, 6),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
        );
        hit.position.set(wx, py, wy);
        hit.userData.pinKey = key;
        pinsGroup.add(hit);

        // The breadboard's own texture already bakes in a visible hole for
        // every one of its ~800 pins, so a dot here would just double up.
        // The arduino's header pins, though, sit under an opaque black
        // header-housing mesh that hides its texture's own pin squares
        // completely, so — unlike 2D, where they're hover-only — give them
        // the same persistent dot every other component's pins get.
        if (!bb) {
          const dot = new THREE.Mesh(new THREE.SphereGeometry(ard ? 1.6 : 2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xc3c9d0 }));
          dot.position.copy(hit.position);
          pinsGroup.add(dot);
        }

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(bb ? 4 : 5, 0.55, 8, 20),
          new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0, depthWrite: false }),
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.copy(hit.position);
        pinsGroup.add(ring);

        pins.set(key, { hit, ring });
      }
    }
  }

  function refreshPins() {
    while (pinsGroup.children.length) pinsGroup.remove(pinsGroup.children[0]);
    pins.clear();
    if (!sim.running) buildPins();
  }

  /**
   * Mirrors 2D's interaction model: while stopped, clicking a pin starts
   * (or completes) a wire, clicking a wire selects it, and clicking/dragging
   * a part selects and repositions it (x/y across the ground plane, snapped
   * the same way 2D snaps). While running, dragging/tapping a live-sim
   * control (sonar wall, pot knob, ldr panel, button, toggle, pir) adjusts
   * it instead. Registered with `capture: true` + `stopImmediatePropagation()`
   * so a hit wins over OrbitControls' own (bubble-phase) listener on the
   * same element instead of also orbiting the camera.
   */
  function setupDragInteraction() {
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const groundPlane = new THREE.Plane();
    const hitPoint = new THREE.Vector3();

    function toNdc(e) {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      return ndc;
    }

    function partGroupFor(object) {
      let o = object;
      while (o && o.userData?.partId === undefined) o = o.parent;
      return o || null;
    }

    // Drag-adjusted controls: cm/pos/light all use the same vertical-drag
    // pattern, differing only in the field, its clamp range, and whether
    // the circuit needs re-solving live (pot/ldr feed the solver; the
    // sonar's cm is only read directly by the interpreter at pulse time).
    const DRAG_CONTROL = {
      wall: { prop: 'cm', min: 2, max: 400, scale: 0.6, resolve: false },
      pot: { prop: 'pos', min: 0, max: 1, scale: 0.006, resolve: true },
      ldr: { prop: 'light', min: 0, max: 100, scale: 0.6, resolve: true },
    };

    function startControl(kind, info, part, e) {
      controls.enabled = false;
      renderer.domElement.setPointerCapture?.(e.pointerId);
      if (kind === 'button') {
        part.pressed = true;
        callbacks?.onLiveResolve?.();
        dragState = { kind, partId: info.partId };
        return;
      }
      if (kind === 'toggle') {
        part.props.on = !part.props.on;
        callbacks?.onSetPartProp?.(info.partId, 'on', part.props.on);
        callbacks?.onLiveResolve?.();
        dragState = { kind: 'tap' };
        return;
      }
      if (kind === 'pir') {
        clearTimeout(part._pirT);
        part.triggered = true;
        callbacks?.onLiveResolve?.();
        part._pirT = setTimeout(() => {
          part.triggered = false;
          callbacks?.onLiveResolve?.();
        }, 1800);
        dragState = { kind: 'tap' };
        return;
      }
      const conf = DRAG_CONTROL[kind];
      dragState = { kind, partId: info.partId, startY: e.clientY, startVal: part.props[conf.prop] ?? 0 };
    }

    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      raycaster.setFromCamera(toNdc(e), camera);

      if (sim.running) {
        if (draggables.size === 0) return;
        const hit = raycaster.intersectObjects([...draggables.values()].map((d) => d.mesh))[0];
        if (!hit) return;
        const info = draggables.get(hit.object.userData.partId);
        const part = doc.parts.find((x) => x.id === info.partId);
        if (!part) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        startControl(info.kind, info, part, e);
        return;
      }

      // Pins take priority over parts (they're small and layered on top).
      if (pins.size > 0) {
        const pinHit = raycaster.intersectObjects([...pins.values()].map((v) => v.hit))[0];
        if (pinHit) {
          e.preventDefault();
          e.stopImmediatePropagation();
          controls.enabled = false;
          renderer.domElement.setPointerCapture?.(e.pointerId);
          dragState = { kind: 'tap' };
          tapPin(pinHit.object.userData.pinKey);
          return;
        }
      }

      const wireHit = raycaster.intersectObjects(group.children, true).find((h) => h.object.userData.wireId);
      if (wireHit) {
        e.preventDefault();
        e.stopImmediatePropagation();
        controls.enabled = false;
        renderer.domElement.setPointerCapture?.(e.pointerId);
        dragState = { kind: 'tap' };
        setSelection({ kind: 'wire', id: wireHit.object.userData.wireId });
        return;
      }

      const hit = raycaster.intersectObjects(group.children, true)[0];
      if (!hit) return;
      const partGroup = partGroupFor(hit.object);
      const part = partGroup && doc.parts.find((x) => x.id === partGroup.userData.partId);
      if (!part) return;
      groundPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, heightAt(part), 0));
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      controls.enabled = false;
      setSelection({ kind: 'part', id: part.id });
      dragState = {
        kind: 'part',
        partId: part.id,
        ox: hitPoint.x - part.x,
        oz: hitPoint.z - part.y,
        carry: carryFor(doc, part),
        moved: false,
      };
      renderer.domElement.setPointerCapture?.(e.pointerId);
    }

    function onMove(e) {
      // Hovering a pin lights up its ring, matching 2D's `.pin:hover .ring`
      // — checked whenever nothing else is being dragged, regardless of
      // running state (mirrors the ring existing but pointer-events being
      // off while running in 2D).
      if (!dragState && !sim.running && pins.size > 0) {
        raycaster.setFromCamera(toNdc(e), camera);
        const hoverHit = raycaster.intersectObjects([...pins.values()].map((v) => v.hit))[0];
        hoverPin = hoverHit ? hoverHit.object.userData.pinKey : null;
      } else if (!dragState) {
        hoverPin = null;
      }

      if (!dragState) return;
      e.stopImmediatePropagation();

      if (dragState.kind === 'tap' || dragState.kind === 'button') return;

      if (dragState.kind in DRAG_CONTROL) {
        const part = doc.parts.find((x) => x.id === dragState.partId);
        if (!part) return;
        const conf = DRAG_CONTROL[dragState.kind];
        // Dragging up (toward the top of the screen) increases the value
        // (farther/higher position/brighter); dragging down decreases it.
        const d = (dragState.startY - e.clientY) * conf.scale;
        part.props[conf.prop] = Math.min(conf.max, Math.max(conf.min, dragState.startVal + d));
        if (conf.resolve) callbacks?.onLiveResolve?.();
        return;
      }

      const part = doc.parts.find((x) => x.id === dragState.partId);
      if (!part) return;
      raycaster.setFromCamera(toNdc(e), camera);
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;
      const [nx, ny] = snapPartPos(part, hitPoint.x - dragState.ox, hitPoint.z - dragState.oz);
      if (nx === part.x && ny === part.y) return;
      const dx = nx - part.x;
      const dy = ny - part.y;
      part.x = nx;
      part.y = ny;
      dragState.moved = true;
      for (const c of dragState.carry) {
        c.part.x += dx;
        c.part.y += dy;
      }
    }

    function onUp(e) {
      if (!dragState) return;
      e.stopImmediatePropagation();
      const part = doc.parts.find((x) => x.id === dragState.partId);
      controls.enabled = true;
      try {
        renderer.domElement.releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      if (part) {
        if (dragState.kind === 'button') {
          part.pressed = false;
          callbacks?.onLiveResolve?.();
        } else if (dragState.kind in DRAG_CONTROL) {
          callbacks?.onSetPartProp?.(dragState.partId, DRAG_CONTROL[dragState.kind].prop, part.props[DRAG_CONTROL[dragState.kind].prop]);
        } else if (dragState.kind === 'part' && dragState.moved) {
          callbacks?.onMovePart?.(dragState.partId, part.x, part.y);
        }
      }
      dragState = null;
    }

    renderer.domElement.addEventListener('pointerdown', onDown, { capture: true });
    renderer.domElement.addEventListener('pointermove', onMove, { capture: true });
    renderer.domElement.addEventListener('pointerup', onUp, { capture: true });
    renderer.domElement.addEventListener('pointercancel', onUp, { capture: true });
  }

  function sig() {
    return JSON.stringify(
      doc.parts.map((p) => [p.id, p.type, p.x, p.y, p.rot, p.props.color, p.props.ohms]).concat(
        doc.wires.map((w) => [w.a, w.b, w.color]),
      ),
    );
  }

  /**
   * A component leg: a straight post from the board surface up to height
   * `h` at (x1,z1), plus — when the pin sits away from that post — a bent
   * cylinder carrying it sideways to (x2,z2) at that same height. Real
   * cylinders (not flat lines) so legs read as metal wire from any angle.
   */
  function leg(g, x1, z1, x2, z2, h) {
    const mat = standard(0xb4bac2, { metalness: 0.7, roughness: 0.3 });
    const vert = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, h, 6), mat);
    vert.position.set(x1, h / 2, z1);
    g.add(vert);
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len > 0.5) {
      const bend = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, len, 6), mat);
      bend.position.set((x1 + x2) / 2, h, (z1 + z2) / 2);
      bend.rotation.z = Math.PI / 2;
      bend.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      g.add(bend);
    }
  }

  /** Parts seated over a breadboard/Arduino render on top of it, not at ground level. */
  function heightAt(p) {
    if (p.type === 'breadboard') return Y.breadboard;
    if (p.type === 'arduino') return Y.arduino;
    for (const b of doc.parts) {
      if (b.type !== 'breadboard' && b.type !== 'arduino') continue;
      const [bx, by, bw, bh] = TYPES[b.type].box;
      const [wx0, wy0] = local2world(b, bx, by);
      const [wx1, wy1] = local2world(b, bx + bw, by + bh);
      const minX = Math.min(wx0, wx1);
      const maxX = Math.max(wx0, wx1);
      const minY = Math.min(wy0, wy1);
      const maxY = Math.max(wy0, wy1);
      if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) return Y[b.type] + 2;
    }
    return 0;
  }

  function cachedTexture(id, svgInner, w, h, bg) {
    const cached = texCache.get(id);
    if (cached && cached.svg === svgInner && cached.w === w && cached.h === h && cached.bg === bg) return cached.tex;
    const tex = svgTexture(svgInner, w, h, requestRender, bg);
    texCache.set(id, { svg: svgInner, w, h, bg, tex });
    return tex;
  }

  const BUILD3 = {
    breadboard(g, p) {
      const [, , w, h] = TYPES.breadboard.box;
      const tex = cachedTexture(p.id, DRAW.breadboard(p), w, h, undefined);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, 8, h),
        [standard(0xd7dbe0), standard(0xd7dbe0), new THREE.MeshStandardMaterial({ map: tex }), standard(0xd7dbe0), standard(0xd7dbe0), standard(0xd7dbe0)],
      );
      mesh.position.set(w / 2, 0, h / 2);
      g.add(mesh);
    },
    arduino(g, p) {
      // DRAW.arduino() draws the board at a literal 280×190 — TYPES.arduino.box
      // is [-14,0,294,190], where that extra 14px is bounding-box padding for
      // hit-testing/thumbnails, not part of the actual drawn board. Sizing the
      // texture/mesh from the box instead of the true drawn size leaves a
      // blank strip (the texture's background fill) down one edge.
      const w = 280;
      const h = 190;
      // Bake the top-face texture once, with the board "off" — the onboard
      // LEDs below are separate live meshes, so the flat texture never needs
      // to show a baked-in lit state (and never needs re-baking, which was
      // previously swapping in a not-yet-loaded texture and flickering).
      const wasRunning = sim.running;
      sim.running = false;
      const tex = cachedTexture(p.id, DRAW.arduino(p), w, h, undefined);
      sim.running = wasRunning;
      // A plain BoxGeometry has hard square corners no matter what the
      // texture draws, so a rounded silkscreen outline (rx="10") always
      // leaves the box's real corner exposed at grazing angles. Use a
      // slab whose own geometry is rounded to match, and remap its UVs
      // from world x/z so the texture still lines up (ExtrudeGeometry's
      // default cap UVs aren't normalized to 0..1).
      const geo = roundedSlabGeometry(w, h, 6, 10);
      const pos = geo.attributes.position;
      const uv = geo.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        uv.setXY(i, (pos.getX(i) + w / 2) / w, 1 - (pos.getZ(i) + h / 2) / h);
      }
      uv.needsUpdate = true;
      const mesh = new THREE.Mesh(geo, [new THREE.MeshStandardMaterial({ map: tex }), standard(0x00838a)]);
      mesh.position.set(w / 2, 0, h / 2);
      g.add(mesh);

      const header = (bw, bx, bz) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(bw, 8, 14), standard(0x1b1d20));
        m.position.set(bx, 7, bz);
        g.add(m);
      };
      header(234, 149, 12);
      header(61, 82.5, 178);
      header(91, 187.5, 178);
      const usb = new THREE.Mesh(new THREE.BoxGeometry(40, 14, 46), standard(0xc4c9cf, { metalness: 0.8, roughness: 0.3 }));
      usb.position.set(6, 10, 53);
      const jack = new THREE.Mesh(new THREE.BoxGeometry(34, 14, 46), standard(0x26282b));
      jack.position.set(7, 10, 141);
      const chip = new THREE.Mesh(new THREE.BoxGeometry(118, 5, 28), standard(0x1d2126));
      chip.position.set(179, 5.5, 114);
      g.add(usb, jack, chip);

      const onboardMat = standard(0x6e5320);
      const onboardLed = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 6), onboardMat);
      onboardLed.position.set(75, 4, 51);
      const powerMat = standard(0x2f5a3a);
      const powerLed = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 6), powerMat);
      powerLed.position.set(75, 4, 65);
      g.add(onboardLed, powerLed);

      dyn.push(() => {
        const st = sim.running ? sim.pins[13] : null;
        const lit = st && st.mode === 'OUTPUT' && st.out > 0.25;
        onboardMat.color.set(lit ? 0xffb020 : 0x6e5320);
        onboardMat.emissive.set(lit ? 0xffb020 : 0x000000);
        powerMat.color.set(sim.running ? 0x6dff8a : 0x2f5a3a);
        powerMat.emissive.set(sim.running ? 0x3dbb5a : 0x000000);
      });
    },
    led(g, p) {
      const c = LED_COLORS[p.props.color] || LED_COLORS.red;
      leg(g, -5, 24, -5, 24, 15);
      leg(g, 5, 24, 5, 24, 15);
      const mat = new THREE.MeshStandardMaterial({ color: c.fill, transparent: true, opacity: 0.82, roughness: 0.25, emissive: c.fill, emissiveIntensity: 0 });
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 2.5, 16), mat);
      flange.position.set(0, 15, 24);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 11, 16), mat);
      barrel.position.set(0, 21.5, 24);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(9, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      dome.position.set(0, 27, 24);
      g.add(flange, barrel, dome);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: c.fill, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
      spr.position.set(0, 25, 24);
      spr.scale.set(70, 70, 1);
      g.add(spr);
      dyn.push(() => {
        const burned = sim.running && sim.burned[p.id];
        const b = sim.running && !burned ? sim.ledB[p.id] || 0 : 0;
        mat.emissiveIntensity = b * 1.6;
        mat.color.set(burned ? 0x444444 : c.fill);
        spr.material.opacity = b * 0.9;
      });
    },
    resistor(g, p) {
      leg(g, -40, 0, -19, 0, 7);
      leg(g, 40, 0, 19, 0, 7);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 38, 16), standard(0xdcc193));
      body.rotation.z = Math.PI / 2;
      body.position.set(0, 7, 0);
      g.add(body);
      const str = String(p.props.ohms);
      const bands = [
        [-9.3, BAND[+str[0]]],
        [-3.3, BAND[+str[1]]],
        [2.7, BAND[str.length - 2]],
        [11.7, 0xc9a227],
      ];
      for (const [x, color] of bands) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(5.35, 5.35, 3.4, 16), standard(color));
        ring.rotation.z = Math.PI / 2;
        ring.position.set(x, 7, 0);
        g.add(ring);
      }
    },
    button(g, p) {
      leg(g, -30, 0, -16, 0, 3);
      leg(g, 30, 0, 16, 0, 3);
      const base = new THREE.Mesh(new THREE.BoxGeometry(32, 10, 32), standard(0x2a2d31));
      base.position.set(0, 5, 0);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 7, 20), standard(0xe5484d));
      cap.position.set(0, 13.5, 0);
      cap.userData.partId = p.id;
      g.add(base, cap);
      draggables.set(p.id, { partId: p.id, mesh: cap, kind: 'button' });
      dyn.push(() => {
        cap.position.y = p.pressed ? 11.5 : 13.5;
      });
    },
    pot(g, p) {
      for (const x of [-10, 0, 10]) leg(g, x, 26, x, 12, 4);
      const body = new THREE.Mesh(new THREE.BoxGeometry(42, 12, 38), standard(0x2456c9));
      body.position.set(0, 8, -7);
      g.add(body);
      const knobGroup = new THREE.Group();
      knobGroup.position.set(0, 14, -6);
      g.add(knobGroup);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 8, 24), standard(0xe3e6ea));
      knob.position.set(0, 4, 0);
      knob.userData.partId = p.id;
      const mark = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1, 10), standard(0x23272d));
      mark.position.set(0, 8.4, -4.5);
      knobGroup.add(knob, mark);
      draggables.set(p.id, { partId: p.id, mesh: knob, kind: 'pot' });
      dyn.push(() => {
        const pos = p.props.pos ?? 0.5;
        knobGroup.rotation.y = (-(-135 + 270 * pos) * Math.PI) / 180;
      });
    },
    buzzer(g, p) {
      leg(g, -5, 26, -5, 14, 3);
      leg(g, 5, 26, 5, 14, 3);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 14, 28), standard(0x1d1f22));
      body.position.set(0, 10, -2);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.6, 16), standard(0x000000));
      cap.position.set(0, 17.2, -2);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(12, 0.8, 6, 32), standard(0x35383d));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 17.1, -2);
      g.add(body, cap, ring);
      dyn.push(() => {
        const on = sim.running && sim.buzz[p.id];
        ring.material.color.set(on ? 0xffd166 : 0x35383d);
        ring.material.emissive.set(on ? 0xaa7a00 : 0x000000);
      });
    },
    lcd(g, p) {
      for (const x of [-75, -65, -55, -45]) leg(g, x, 40, x, 30, 12);
      const body = new THREE.Mesh(new THREE.BoxGeometry(180, 3, 66), standard(0x1f7a3a));
      body.position.set(0, 13.5, -3);
      const bezel = new THREE.Mesh(new THREE.BoxGeometry(160, 5, 44), standard(0x16181b));
      bezel.position.set(0, 17.5, -9);
      g.add(body, bezel);
      const cv = document.createElement('canvas');
      cv.width = 608;
      cv.height = 144;
      const ctx = cv.getContext('2d');
      const tex = new THREE.CanvasTexture(cv);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(152, 36), new THREE.MeshBasicMaterial({ map: tex }));
      screen.rotation.x = -Math.PI / 2;
      screen.position.set(0, 20.1, -9);
      g.add(screen);
      let last = null;
      dyn.push(() => {
        const on = sim.running && sim.lcdOn[p.id];
        const data = on && sim.lcdI2C[p.id] && sim.lcd.init;
        const bl = on && (!data || sim.lcd.bl);
        const signature = [on, data, bl, data ? sim.lcd.rows.map((r) => r.join('')).join('|') : ''].join('/');
        if (signature === last) return;
        last = signature;
        ctx.fillStyle = bl ? '#3f6fe0' : '#1c2f66';
        ctx.fillRect(0, 0, 608, 144);
        if (data) {
          ctx.font = '500 44px "JetBrains Mono", ui-monospace, monospace';
          ctx.fillStyle = sim.lcd.bl ? '#f2f6ff' : '#8ea3d8';
          sim.lcd.rows.forEach((row, r) => row.forEach((ch, c) => ctx.fillText(ch, 6 + c * 37.7, r ? 124 : 60)));
        } else if (on) {
          ctx.fillStyle = 'rgba(255,255,255,.22)';
          for (let c = 0; c < 16; c++) ctx.fillRect(6 + c * 37.7, 20, 30, 44);
        }
        tex.needsUpdate = true;
      });
    },
    sonar(g, p) {
      for (const x of [-15, -5, 5, 15]) leg(g, x, 34, x, 34, 7);
      const board = new THREE.Mesh(new THREE.BoxGeometry(90, 40, 3), standard(0x1b5fae));
      board.position.set(0, 27, 34);
      const transducer = (x) => {
        const outer = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 12, 24), standard(0xc9ced4, { metalness: 0.6, roughness: 0.35 }));
        outer.rotation.x = Math.PI / 2;
        outer.position.set(x, 27, 26.5);
        const inner = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 12.4, 24), standard(0x2b2f35));
        inner.rotation.x = Math.PI / 2;
        inner.position.set(x, 27, 26.5);
        g.add(outer, inner);
      };
      transducer(-24);
      transducer(24);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(110, 70, 6), standard(0xff9f1c, { transparent: true, opacity: 0.6 }));
      wall.position.set(0, 35, 0);
      wall.userData.partId = p.id;
      g.add(board, wall);
      draggables.set(p.id, { partId: p.id, mesh: wall, kind: 'wall' });

      // A rod between the transducers and the wall, plus a floating "NN cm"
      // label — the wall's move is mostly a depth (into-the-screen) shift,
      // which barely reads on screen from a top-down-ish angle, so this
      // gives the distance change a form that's legible from any camera
      // angle without needing to orbit to see it.
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 1, 10), standard(0xffce6b, { emissive: 0xffce6b, emissiveIntensity: 0.4 }));
      rod.rotation.x = Math.PI / 2;
      g.add(rod);

      const lc = document.createElement('canvas');
      lc.width = 128;
      lc.height = 48;
      const lctx = lc.getContext('2d');
      const labelTex = new THREE.CanvasTexture(lc);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false }));
      label.scale.set(44, 16, 1);
      g.add(label);

      const SENSOR_Z = 26;
      let lastCm = null;
      dyn.push(() => {
        const cm = Math.round(p.props.cm ?? 50);
        wall.position.z = 20 - cm * 1.2;
        const len = Math.max(Math.abs(SENSOR_Z - wall.position.z), 0.01);
        const midZ = (SENSOR_Z + wall.position.z) / 2;
        rod.scale.y = len;
        rod.position.set(0, 27, midZ);
        label.position.set(0, 46, midZ);
        if (cm === lastCm) return;
        lastCm = cm;
        lctx.clearRect(0, 0, 128, 48);
        lctx.fillStyle = 'rgba(20,21,26,.85)';
        lctx.beginPath();
        if (lctx.roundRect) lctx.roundRect(4, 4, 120, 40, 10);
        else lctx.rect(4, 4, 120, 40);
        lctx.fill();
        lctx.fillStyle = '#ffce6b';
        lctx.font = 'bold 24px "Instrument Sans", sans-serif';
        lctx.textAlign = 'center';
        lctx.textBaseline = 'middle';
        lctx.fillText(cm + ' cm', 64, 25);
        labelTex.needsUpdate = true;
      });
    },
    rgbled(g, p) {
      for (const x of [-15, -5, 5, 15]) leg(g, x, 24, x, 24, 15);
      const domeMat = new THREE.MeshStandardMaterial({ color: 0xeef0f2, transparent: true, opacity: 0.55, roughness: 0.25 });
      const dome = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 11, 20), domeMat);
      dome.position.set(0, 20, 24);
      g.add(dome);
      const chans = [
        [-15, 0xff3b30, 'R'],
        [-5, 0x30d158, 'G'],
        [5, 0x2f8bff, 'B'],
      ].map(([x, col]) => {
        const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0 });
        const dot = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), mat);
        dot.position.set(x, 16, 26);
        g.add(dot);
        return mat;
      });
      dyn.push(() => {
        const b = (ch) => (sim.running && !sim.burned[p.id + ':' + ch] ? sim.ledB[p.id + ':' + ch] || 0 : 0);
        ['R', 'G', 'B'].forEach((ch, i) => {
          chans[i].emissiveIntensity = b(ch) * 1.6;
        });
      });
    },
    diode(g) {
      leg(g, -16, 0, -8, 0, 3);
      leg(g, 16, 0, 8, 0, 3);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 16, 12), standard(0x2a2d31));
      body.rotation.z = Math.PI / 2;
      body.position.set(0, 3, 0);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 1.4, 12), standard(0xc9ced4));
      band.rotation.z = Math.PI / 2;
      band.position.set(6, 3, 0);
      g.add(body, band);
    },
    capacitor(g) {
      leg(g, -10, 0, -10, 0, 6);
      leg(g, 10, 0, 10, 0, 6);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 15, 20), standard(0x3a6b5c));
      body.position.set(0, 13.5, 0);
      g.add(body);
    },
    toggle(g, p) {
      leg(g, -15, 0, -8, 0, 2);
      leg(g, 15, 0, 8, 0, 2);
      const base = new THREE.Mesh(new THREE.BoxGeometry(20, 8, 14), standard(0x2a2d31));
      base.position.set(0, 4, 0);
      const knob = new THREE.Mesh(new THREE.BoxGeometry(7, 6, 8), standard(0x8a9098));
      knob.position.set(-3.5, 9, 0);
      knob.userData.partId = p.id;
      g.add(base, knob);
      draggables.set(p.id, { partId: p.id, mesh: knob, kind: 'toggle' });
      dyn.push(() => {
        knob.position.x = p.props.on ? 3.5 : -3.5;
        knob.material.color.set(p.props.on ? 0x30d158 : 0x8a9098);
      });
    },
    ldr(g, p) {
      leg(g, -10, 0, -6, 0, 2);
      leg(g, 10, 0, 6, 0, 2);
      const mat = standard(0xdcdf5f, { transparent: true });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 3, 20), mat);
      disc.position.set(0, 1.5, 0);
      disc.userData.partId = p.id;
      g.add(disc);
      draggables.set(p.id, { partId: p.id, mesh: disc, kind: 'ldr' });
      dyn.push(() => {
        mat.opacity = 0.4 + 0.6 * ((p.props.light ?? 70) / 100);
      });
    },
    pir(g, p) {
      for (const x of [-10, 0, 10]) leg(g, x, 26, x, 20, 4);
      const mat = new THREE.MeshStandardMaterial({ color: 0xe9ecef, transparent: true, opacity: 0.85 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(22, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), mat);
      dome.position.set(0, 20, -2);
      dome.userData.partId = p.id;
      g.add(dome);
      draggables.set(p.id, { partId: p.id, mesh: dome, kind: 'pir' });
      dyn.push(() => {
        const on = sim.running && p.triggered;
        mat.emissive.set(on ? 0x8fffb0 : 0x000000);
        mat.emissiveIntensity = on ? 0.6 : 0;
      });
    },
    relay(g, p) {
      for (const x of [-20, -10, 0, 10, 20]) leg(g, x, 26, x, 12, 4);
      const body = new THREE.Mesh(new THREE.BoxGeometry(52, 16, 30), standard(0x2b6bd6));
      body.position.set(0, 8, 0);
      const coil = new THREE.Mesh(new THREE.BoxGeometry(16, 16, 16), standard(0x1d1f22));
      coil.position.set(-6, 8, 4);
      const ledMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, emissive: 0x000000 });
      const led = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8), ledMat);
      led.position.set(18, 14, 6);
      g.add(body, coil, led);
      dyn.push(() => {
        const on = sim.running && sim.relayOn[p.id];
        ledMat.color.set(on ? 0x30d158 : 0x3a3d42);
        ledMat.emissive.set(on ? 0x1e9e46 : 0x000000);
      });
    },
    transistor(g, p) {
      for (const x of [-10, 0, 10]) leg(g, x, 20, x, 8, 3);
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(14, 14, 16, 20, 1, false, -Math.PI / 2, Math.PI),
        standard(0x2a2d31),
      );
      body.position.set(0, 8, 0);
      g.add(body);
      dyn.push(() => {
        const on = sim.running && sim.transOn[p.id];
        body.material.emissive.set(on ? 0xffd166 : 0x000000);
        body.material.emissiveIntensity = on ? 0.6 : 0;
      });
    },
    motor(g, p) {
      leg(g, -8, 22, -8, 15, 4);
      leg(g, 8, 22, 8, 15, 4);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, 30, 24), standard(0x4a4e54, { metalness: 0.5, roughness: 0.4 }));
      body.rotation.x = Math.PI / 2;
      body.position.set(0, 19, 0);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 14, 10), standard(0xc9ced4, { metalness: 0.8 }));
      shaft.position.set(0, 19, -22);
      g.add(body, shaft);
      dyn.push(() => {
        const spd = sim.running ? sim.motorSpeed[p.id] || 0 : 0;
        shaft.rotation.z += spd * 0.9;
      });
    },
    servo(g, p) {
      for (const x of [-10, 0, 10]) leg(g, x, 34, x, 28, 4);
      const body = new THREE.Mesh(new THREE.BoxGeometry(44, 26, 48), standard(0x2456c9));
      body.position.set(0, 13, 6);
      g.add(body);
      const knobGroup = new THREE.Group();
      knobGroup.position.set(0, 26, -6);
      g.add(knobGroup);
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 6, 24), standard(0xe3e6ea));
      const horn = new THREE.Mesh(new THREE.BoxGeometry(32, 2.5, 5), standard(0xe3e6ea));
      horn.position.set(0, 6, 0);
      knobGroup.add(knob, horn);
      dyn.push(() => {
        const a = sim.running ? sim.servoA[p.id] ?? 90 : 90;
        knobGroup.rotation.y = (-(a - 90) * Math.PI) / 180;
      });
    },
    sevenseg(g, p) {
      for (let i = 0; i < 8; i++) leg(g, -31.5 + i * 9, 44, -31.5 + i * 9, 40, 4);
      leg(g, 0, -44, 0, -40, 4);
      const body = new THREE.Mesh(new THREE.BoxGeometry(80, 4, 100), standard(0x1d1f22));
      body.position.set(0, 2, 3);
      g.add(body);
      const cv = document.createElement('canvas');
      cv.width = cv.height = 200;
      const ctx = cv.getContext('2d');
      const tex = new THREE.CanvasTexture(cv);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(60, 80), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      screen.rotation.x = -Math.PI / 2;
      screen.position.set(0, 4.1, 3);
      g.add(screen);
      const segRects = { a: [60, 10, 80, 26], b: [142, 30, 26, 80], c: [142, 116, 26, 80], d: [60, 168, 80, 26], e: [32, 116, 26, 80], f: [32, 30, 26, 80], g: [60, 89, 80, 26] };
      let last = null;
      dyn.push(() => {
        const on = sim.running ? sim.segOn[p.id] || {} : {};
        const signature = JSON.stringify(on);
        if (signature === last) return;
        last = signature;
        ctx.clearRect(0, 0, 200, 200);
        for (const seg in segRects) {
          const [x, y, w, h] = segRects[seg];
          ctx.fillStyle = on[seg] ? '#ff3b30' : '#3a1210';
          ctx.fillRect(x, y, w, h);
        }
        ctx.fillStyle = on.dp ? '#ff3b30' : '#3a1210';
        ctx.beginPath();
        ctx.arc(182, 182, 8, 0, Math.PI * 2);
        ctx.fill();
        tex.needsUpdate = true;
      });
    },
  };

  function buildPart(p) {
    const g = new THREE.Group();
    g.position.set(p.x, heightAt(p), p.y);
    g.rotation.y = (-(p.rot || 0) * Math.PI) / 180;
    g.userData.partId = p.id;
    const builder = BUILD3[p.type];
    if (builder) builder(g, p);
    return g;
  }

  function buildWires() {
    for (const w of doc.wires) {
      const [pa, pinA] = w.a.split('.');
      const [pb, pinB] = w.b.split('.');
      const partA = doc.parts.find((x) => x.id === pa);
      const partB = doc.parts.find((x) => x.id === pb);
      if (!partA || !partB || !TYPES[partA.type].pins[pinA] || !TYPES[partB.type].pins[pinB]) continue;
      const [ax, ay] = local2world(partA, ...TYPES[partA.type].pins[pinA]);
      const [bx, by] = local2world(partB, ...TYPES[partB.type].pins[pinB]);
      const ya = heightAt(partA) + 6;
      const yb = heightAt(partB) + 6;
      const mid = new THREE.Vector3((ax + bx) / 2, Math.max(ya, yb) + 24, (ay + by) / 2);
      const curve3 = new THREE.CatmullRomCurve3([
        new THREE.Vector3(ax, ya, ay),
        mid,
        new THREE.Vector3(bx, yb, by),
      ]);
      const geo = new THREE.TubeGeometry(curve3, 16, 1.6, 6, false);
      const selected = sel?.kind === 'wire' && sel.id === w.id;
      const mat = standard(w.color || '#ffd166', { roughness: 0.4, emissive: selected ? 0xffffff : 0x000000, emissiveIntensity: selected ? 0.4 : 0 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.wireId = w.id;
      group.add(mesh);
    }
  }

  function build() {
    while (group.children.length) group.remove(group.children[0]);
    dyn.length = 0;
    draggables.clear();
    for (const p of doc.parts) group.add(buildPart(p));
    buildWires();
    refreshPins();
    // Registered once per build(), not per refreshPins() call (tapPin()
    // calls refreshPins() directly, without going through here, on every
    // pin click) — it reads the live `pins` Map by reference each frame,
    // so it stays correct across those standalone refreshes without
    // needing to be re-pushed (and leaking a duplicate closure) each time.
    dyn.push(() => {
      for (const [key, entry] of pins) {
        entry.ring.material.opacity = key === pending || key === hoverPin ? 1 : 0;
      }
    });
    layoutSig = sig();
  }

  /**
   * Positions the camera so the whole circuit's bounding box is in frame,
   * accounting for the viewport's aspect ratio (not just a flat multiple of
   * bbox size) and generous headroom for parts that stand tall off the board
   * (motors, servos, the sonar's echo lines).
   */
  function fit() {
    const [x0, y0, x1, y1] = partsBBox(doc);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const hx = Math.max((x1 - x0) / 2, 100);
    const hz = Math.max((y1 - y0) / 2, 100);
    const hy = 90;
    const halfDiag = Math.sqrt(hx * hx + hy * hy + hz * hz);
    // Read the container directly rather than trusting camera.aspect, which
    // is only current once resize() has run at least once after mount.
    const aspect = (container.clientWidth || 1) / (container.clientHeight || 1) || 1;
    const vFov = (camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const effHalfAngle = Math.min(vFov, hFov) / 2;
    const dist = (halfDiag / Math.sin(effHalfAngle)) * 1.25;
    const dir = new THREE.Vector3(-0.55, 0.85, 0.85).normalize();
    controls.target.set(cx, 0, cy);
    camera.position.set(cx + dir.x * dist, dir.y * dist, cy + dir.z * dist);
    controls.update();
    fitted = true;
  }

  function requestRender() {
    /* three.js redraws every frame in loop(); this just marks textures dirty via callers */
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    const s = sig();
    if (s !== layoutSig) {
      build();
      if (!fitted) fit();
    }
    if (sim.running !== wasRunning) {
      wasRunning = sim.running;
      // Pins/selection only make sense while stopped, and the interactive
      // controls' meshes only get registered by a fresh build() — refresh
      // both the moment running starts or stops.
      build();
      updateStatus();
    }
    for (const fn of dyn) fn();
    controls.update();
    renderer.render(scene, camera);
  }

  function dispose() {
    cancelAnimationFrame(raf);
    document.removeEventListener('keydown', onKeyDown);
    for (const p of doc.parts) clearTimeout(p._pirT);
    ro?.disconnect();
    controls?.dispose();
    renderer?.dispose();
    if (renderer?.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
  }

  function addPartAtViewCenter(type) {
    const def = TYPES[type];
    const [bx, by, bw, bh] = def.box;
    const cx = controls.target.x;
    const cy = controls.target.z;
    const tmp = { type, rot: 0 };
    const [x, y] = snapPartPos(tmp, cx - (bx + bw / 2), cy - (by + bh / 2));
    callbacks?.onAddPart?.(type, x, y);
  }

  function dolly(factor) {
    const dir = new THREE.Vector3().subVectors(camera.position, controls.target).multiplyScalar(factor);
    const dist = dir.length();
    if (dist < controls.minDistance || dist > controls.maxDistance) return;
    camera.position.copy(controls.target).add(dir);
    controls.update();
  }

  init();
  callbacks?.onReady?.();
  updateStatus();

  return {
    setDoc,
    fit,
    dispose,
    addPartAtViewCenter,
    zoomIn: () => dolly(1 / 1.25),
    zoomOut: () => dolly(1.25),
    deleteSelected,
  };
}
