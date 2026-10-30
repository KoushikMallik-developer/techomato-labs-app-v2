import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createBoardEngine } from './board';

/**
 * jsdom ships neither ResizeObserver nor DOMMatrix/DOMPoint (verified directly —
 * both are `undefined` in this project's jsdom version), and board.js's mount()
 * calls `new ResizeObserver(...)` unconditionally while every pointer handler
 * calls `svgEl.getScreenCTM()`. Real browser behavior there is an identity-ish
 * transform for an unscaled/untranslated <svg> (which is what a 0x0-rect jsdom
 * layout amounts to anyway), so a plain identity stub reproduces it exactly —
 * this isn't approximating browser behavior, it's the same behavior a real
 * browser would report for this element in this environment.
 */
class FakeDOMPoint {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  matrixTransform() {
    return new FakeDOMPoint(this.x, this.y);
  }
}
class FakeDOMMatrix {
  inverse() {
    return this;
  }
}
class FakeResizeObserver {
  observe() {}
  disconnect() {}
}

function makeSvg() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.getScreenCTM = () => new FakeDOMMatrix();
  document.body.appendChild(svg);
  return svg;
}

function makeCallbacks() {
  return {
    onAddWire: vi.fn(),
    onDeleteWire: vi.fn(),
    onDeletePart: vi.fn(),
    onMovePart: vi.fn(),
    onRotatePart: vi.fn(),
    onSetPartProp: vi.fn(),
    onAddPart: vi.fn(),
    onSelectionChange: vi.fn(),
    onStatus: vi.fn(),
    onLiveResolve: vi.fn(),
  };
}

function pointer(type, target, opts = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 0, clientY: 0, ...opts });
  target.dispatchEvent(event);
  return event;
}

const led = { id: 'led-1', type: 'led', x: 100, y: 100, rot: 0, props: { color: 'red' } };
const led2 = { id: 'led-2', type: 'led', x: 200, y: 100, rot: 0, props: { color: 'green' } };

beforeEach(() => {
  vi.stubGlobal('DOMPoint', FakeDOMPoint);
  vi.stubGlobal('DOMMatrix', FakeDOMMatrix);
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('createBoardEngine — lifecycle', () => {
  it('mount() attaches listeners and renders once; unmount() detaches them', async () => {
    const svg = makeSvg();
    const engine = createBoardEngine(svg, makeCallbacks());
    engine.mount();
    await new Promise((r) => requestAnimationFrame(r));
    expect(svg.innerHTML).not.toBe('');
    const addSpy = vi.spyOn(svg, 'removeEventListener');
    engine.unmount();
    expect(addSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
  });

  it('getDoc() starts empty and reflects setDoc()', () => {
    const svg = makeSvg();
    const engine = createBoardEngine(svg, makeCallbacks());
    expect(engine.getDoc()).toEqual({ parts: [], wires: [] });
    engine.setDoc({ parts: [led], wires: [] });
    expect(engine.getDoc().parts).toHaveLength(1);
    expect(engine.getDoc().parts[0]).toMatchObject({ id: 'led-1' });
  });

  it('getSim() returns the shared sim singleton', async () => {
    const { sim } = await import('./engineStore');
    const svg = makeSvg();
    const engine = createBoardEngine(svg, makeCallbacks());
    expect(engine.getSim()).toBe(sim);
  });
});

describe('createBoardEngine — rendering', () => {
  it('renders a <g class="part"> per part after mount + setDoc', async () => {
    const svg = makeSvg();
    const engine = createBoardEngine(svg, makeCallbacks());
    engine.mount();
    engine.setDoc({ parts: [led, led2], wires: [] });
    engine.requestRender();
    await new Promise((r) => requestAnimationFrame(r));
    expect(svg.querySelectorAll('[data-part]')).toHaveLength(2);
    expect(svg.querySelector('[data-part="led-1"]')).toBeTruthy();
  });

  it('renders pins while idle, hides them while running', async () => {
    const svg = makeSvg();
    const engine = createBoardEngine(svg, makeCallbacks());
    engine.mount();
    engine.setDoc({ parts: [led], wires: [], running: false });
    await new Promise((r) => requestAnimationFrame(r));
    expect(svg.querySelectorAll('[data-pin]').length).toBeGreaterThan(0);

    engine.setDoc({ parts: [led], wires: [], running: true });
    await new Promise((r) => requestAnimationFrame(r));
    expect(svg.querySelectorAll('[data-pin]')).toHaveLength(0);
    expect(svg.classList.contains('running')).toBe(true);
  });

  it('reports status text through onStatus', async () => {
    const callbacks = makeCallbacks();
    const svg = makeSvg();
    const engine = createBoardEngine(svg, callbacks);
    engine.mount();
    engine.setDoc({ parts: [], wires: [] });
    await new Promise((r) => requestAnimationFrame(r));
    expect(callbacks.onStatus).toHaveBeenCalledWith(expect.stringMatching(/Tap a pin/));
  });

  it('renders a wire as a path between its two resolved pins', async () => {
    const svg = makeSvg();
    const engine = createBoardEngine(svg, makeCallbacks());
    engine.mount();
    engine.setDoc({ parts: [led, led2], wires: [{ id: 'w-1', a: 'led-1.A', b: 'led-2.A', color: '#fff' }] });
    await new Promise((r) => requestAnimationFrame(r));
    expect(svg.querySelector('[data-wire="w-1"]')).toBeTruthy();
  });

  it('silently skips a wire whose endpoint no longer resolves', async () => {
    const svg = makeSvg();
    const engine = createBoardEngine(svg, makeCallbacks());
    engine.mount();
    engine.setDoc({ parts: [led], wires: [{ id: 'w-1', a: 'led-1.A', b: 'missing-part.A', color: '#fff' }] });
    await new Promise((r) => requestAnimationFrame(r));
    expect(svg.querySelector('[data-wire="w-1"]')).toBeNull();
  });
});

describe('createBoardEngine — selection and wiring via pointer events', () => {
  function setupSelected() {
    const callbacks = makeCallbacks();
    const svg = makeSvg();
    const engine = createBoardEngine(svg, callbacks);
    engine.mount();
    engine.setDoc({ parts: [led, led2], wires: [] });
    return { svg, engine, callbacks };
  }

  it('clicking a part selects it', async () => {
    const { svg, callbacks } = setupSelected();
    await new Promise((r) => requestAnimationFrame(r));
    const partEl = svg.querySelector('[data-part="led-1"]');
    pointer('pointerdown', partEl, { clientX: 100, clientY: 100 });
    pointer('pointerup', partEl, { clientX: 100, clientY: 100 });
    expect(callbacks.onSelectionChange).toHaveBeenCalledWith({ kind: 'part', id: 'led-1' });
  });

  it('clicking empty space clears the selection', async () => {
    const { svg, engine, callbacks } = setupSelected();
    await new Promise((r) => requestAnimationFrame(r));
    const partEl = svg.querySelector('[data-part="led-1"]');
    pointer('pointerdown', partEl, { clientX: 100, clientY: 100 });
    pointer('pointerup', partEl, { clientX: 100, clientY: 100 });
    callbacks.onSelectionChange.mockClear();
    pointer('pointerdown', svg, { clientX: 400, clientY: 400 });
    pointer('pointerup', svg, { clientX: 400, clientY: 400 });
    expect(callbacks.onSelectionChange).toHaveBeenCalledWith(null);
    expect(engine).toBeTruthy();
  });

  it('dragging a part reports its new position on pointer up', async () => {
    const { svg, callbacks } = setupSelected();
    await new Promise((r) => requestAnimationFrame(r));
    const partEl = svg.querySelector('[data-part="led-1"]');
    pointer('pointerdown', partEl, { clientX: 100, clientY: 100 });
    pointer('pointermove', svg, { clientX: 140, clientY: 100 });
    pointer('pointerup', svg, { clientX: 140, clientY: 100 });
    expect(callbacks.onMovePart).toHaveBeenCalledWith('led-1', expect.any(Number), expect.any(Number));
  });

  it('clicking a wire selects it', async () => {
    const callbacks = makeCallbacks();
    const svg = makeSvg();
    const engine = createBoardEngine(svg, callbacks);
    engine.mount();
    engine.setDoc({ parts: [led, led2], wires: [{ id: 'w-1', a: 'led-1.A', b: 'led-2.A', color: '#fff' }] });
    await new Promise((r) => requestAnimationFrame(r));
    const wireEl = svg.querySelector('[data-wire="w-1"]');
    pointer('pointerdown', wireEl, { clientX: 150, clientY: 100 });
    pointer('pointerup', wireEl, { clientX: 150, clientY: 100 });
    expect(callbacks.onSelectionChange).toHaveBeenCalledWith({ kind: 'wire', id: 'w-1' });
  });

  it('tapping two different pins adds a wire between them', async () => {
    const { svg, callbacks } = setupSelected();
    await new Promise((r) => requestAnimationFrame(r));
    const pinA = svg.querySelector('[data-pin="led-1.A"]');
    const pinB = svg.querySelector('[data-pin="led-2.A"]');
    pointer('pointerdown', pinA, { clientX: 105, clientY: 124 });
    pointer('pointerup', pinA, { clientX: 105, clientY: 124 });
    pointer('pointerdown', pinB, { clientX: 205, clientY: 124 });
    pointer('pointerup', pinB, { clientX: 205, clientY: 124 });
    expect(callbacks.onAddWire).toHaveBeenCalledWith('led-1.A', 'led-2.A');
  });

  it('tapping the same pin twice cancels the pending wire', async () => {
    const { svg, callbacks } = setupSelected();
    await new Promise((r) => requestAnimationFrame(r));
    const pinA = svg.querySelector('[data-pin="led-1.A"]');
    pointer('pointerdown', pinA, { clientX: 105, clientY: 124 });
    pointer('pointerup', pinA, { clientX: 105, clientY: 124 });
    pointer('pointerdown', pinA, { clientX: 105, clientY: 124 });
    pointer('pointerup', pinA, { clientX: 105, clientY: 124 });
    expect(callbacks.onAddWire).not.toHaveBeenCalled();
  });
});

describe('createBoardEngine — keyboard and public API', () => {
  it('Delete key removes the selected part', async () => {
    const callbacks = makeCallbacks();
    const svg = makeSvg();
    const engine = createBoardEngine(svg, callbacks);
    engine.mount();
    engine.setDoc({ parts: [led], wires: [] });
    await new Promise((r) => requestAnimationFrame(r));
    const partEl = svg.querySelector('[data-part="led-1"]');
    pointer('pointerdown', partEl, { clientX: 100, clientY: 100 });
    pointer('pointerup', partEl, { clientX: 100, clientY: 100 });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(callbacks.onDeletePart).toHaveBeenCalledWith('led-1');
  });

  it('a keydown inside a text input is ignored (so typing Delete in a field does not delete the part)', async () => {
    const callbacks = makeCallbacks();
    const svg = makeSvg();
    const engine = createBoardEngine(svg, callbacks);
    engine.mount();
    engine.setDoc({ parts: [led], wires: [] });
    await new Promise((r) => requestAnimationFrame(r));
    const partEl = svg.querySelector('[data-part="led-1"]');
    pointer('pointerdown', partEl, { clientX: 100, clientY: 100 });
    pointer('pointerup', partEl, { clientX: 100, clientY: 100 });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(callbacks.onDeletePart).not.toHaveBeenCalled();
  });

  it('Escape clears the selection', async () => {
    const callbacks = makeCallbacks();
    const svg = makeSvg();
    const engine = createBoardEngine(svg, callbacks);
    engine.mount();
    engine.setDoc({ parts: [led], wires: [] });
    await new Promise((r) => requestAnimationFrame(r));
    const partEl = svg.querySelector('[data-part="led-1"]');
    pointer('pointerdown', partEl, { clientX: 100, clientY: 100 });
    pointer('pointerup', partEl, { clientX: 100, clientY: 100 });
    callbacks.onSelectionChange.mockClear();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(callbacks.onSelectionChange).toHaveBeenCalledWith(null);
  });

  it('deleteSelected() is a no-op with nothing selected, and never deletes the Arduino', async () => {
    const callbacks = makeCallbacks();
    const svg = makeSvg();
    const engine = createBoardEngine(svg, callbacks);
    engine.mount();
    engine.deleteSelected();
    expect(callbacks.onDeletePart).not.toHaveBeenCalled();

    const arduino = { id: 'ard-1', type: 'arduino', x: 0, y: 0, rot: 0, props: {} };
    engine.setDoc({ parts: [arduino], wires: [] });
    await new Promise((r) => requestAnimationFrame(r));
    const partEl = svg.querySelector('[data-part="ard-1"]');
    pointer('pointerdown', partEl, { clientX: 0, clientY: 0 });
    pointer('pointerup', partEl, { clientX: 0, clientY: 0 });
    engine.deleteSelected();
    expect(callbacks.onDeletePart).not.toHaveBeenCalled();
  });

  it('rotateSelected() dispatches onRotatePart for the selected part', async () => {
    const callbacks = makeCallbacks();
    const svg = makeSvg();
    const engine = createBoardEngine(svg, callbacks);
    engine.mount();
    engine.setDoc({ parts: [led], wires: [] });
    await new Promise((r) => requestAnimationFrame(r));
    const partEl = svg.querySelector('[data-part="led-1"]');
    pointer('pointerdown', partEl, { clientX: 100, clientY: 100 });
    pointer('pointerup', partEl, { clientX: 100, clientY: 100 });
    engine.rotateSelected();
    expect(callbacks.onRotatePart).toHaveBeenCalledWith('led-1');
  });

  it('rotateSelected() is a no-op when a wire (not a part) is selected', async () => {
    const callbacks = makeCallbacks();
    const svg = makeSvg();
    const engine = createBoardEngine(svg, callbacks);
    engine.mount();
    engine.setDoc({ parts: [led, led2], wires: [{ id: 'w-1', a: 'led-1.A', b: 'led-2.A', color: '#fff' }] });
    await new Promise((r) => requestAnimationFrame(r));
    const wireEl = svg.querySelector('[data-wire="w-1"]');
    pointer('pointerdown', wireEl, { clientX: 150, clientY: 100 });
    pointer('pointerup', wireEl, { clientX: 150, clientY: 100 });
    engine.rotateSelected();
    expect(callbacks.onRotatePart).not.toHaveBeenCalled();
  });

  it('addPartAtViewCenter adds a part centered in the current view', () => {
    const callbacks = makeCallbacks();
    const svg = makeSvg();
    const engine = createBoardEngine(svg, callbacks);
    engine.mount();
    engine.addPartAtViewCenter('led');
    expect(callbacks.onAddPart).toHaveBeenCalledWith('led', expect.any(Number), expect.any(Number));
  });

  it('zoomIn/zoomOut change the viewBox width', () => {
    const svg = makeSvg();
    const engine = createBoardEngine(svg, makeCallbacks());
    engine.mount();
    const before = svg.getAttribute('viewBox');
    engine.zoomIn();
    const afterZoomIn = svg.getAttribute('viewBox');
    expect(afterZoomIn).not.toBe(before);
    engine.zoomOut();
    expect(svg.getAttribute('viewBox')).not.toBe(afterZoomIn);
  });

  it('fitView() no-ops when the element has no layout size (as in this test environment)', () => {
    const svg = makeSvg();
    const engine = createBoardEngine(svg, makeCallbacks());
    engine.mount();
    expect(() => engine.fitView()).not.toThrow();
  });
});

describe('createBoardEngine — joystick', () => {
  const joy = () => ({ id: 'joy-1', type: 'joystick', x: 300, y: 300, rot: 0, props: { x: 0.5, y: 0.5 } });

  async function runningBoard() {
    const callbacks = makeCallbacks();
    const svg = makeSvg();
    const engine = createBoardEngine(svg, callbacks);
    engine.mount();
    engine.setDoc({ parts: [joy()], wires: [], running: true });
    await new Promise((r) => requestAnimationFrame(r));
    const stick = svg.querySelector('[data-part="joy-1"] [data-ctl]');
    return { svg, engine, callbacks, stick, part: () => engine.getDoc().parts[0] };
  }

  it('follows a drag, then springs back to the middle without pressing the button', async () => {
    const { svg, stick, part, callbacks } = await runningBoard();
    pointer('pointerdown', stick, { clientX: 300, clientY: 300 });
    pointer('pointermove', svg, { clientX: 320, clientY: 300 });
    expect(part().props.x).toBe(1);
    expect(callbacks.onLiveResolve).toHaveBeenCalled();
    pointer('pointerup', svg, { clientX: 320, clientY: 300 });
    expect(part().props).toMatchObject({ x: 0.5, y: 0.5 });
    expect(part().pressed).toBeFalsy();
  });

  it('a tap presses its button briefly', async () => {
    const { svg, stick, part } = await runningBoard(); // before fake timers: it waits for a frame
    vi.useFakeTimers();
    try {
      pointer('pointerdown', stick, { clientX: 300, clientY: 300 });
      pointer('pointerup', svg, { clientX: 300, clientY: 300 });
      expect(part().pressed).toBe(true);
      vi.advanceTimersByTime(300);
      expect(part().pressed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
