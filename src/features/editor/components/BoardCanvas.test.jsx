import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import BoardCanvas from './BoardCanvas';
import { createBoardEngine } from '../engine/board';

vi.mock('../engine/board', () => ({
  createBoardEngine: vi.fn(),
}));

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

let engine;

beforeEach(() => {
  vi.clearAllMocks();
  engine = { mount: vi.fn(), unmount: vi.fn(), setDoc: vi.fn() };
  createBoardEngine.mockReturnValue(engine);
});

describe('BoardCanvas', () => {
  it('creates and mounts the engine once, on an <svg>', () => {
    render(<BoardCanvas parts={[]} wires={[]} running={false} callbacks={makeCallbacks()} />);
    expect(createBoardEngine).toHaveBeenCalledTimes(1);
    const [svgEl] = createBoardEngine.mock.calls[0];
    expect(svgEl.tagName.toLowerCase()).toBe('svg');
    expect(engine.mount).toHaveBeenCalledTimes(1);
  });

  it('calls onEngineReady with the created engine', () => {
    const onEngineReady = vi.fn();
    render(<BoardCanvas parts={[]} wires={[]} running={false} callbacks={makeCallbacks()} onEngineReady={onEngineReady} />);
    expect(onEngineReady).toHaveBeenCalledWith(engine);
  });

  it('unmounts the engine on teardown', () => {
    const { unmount } = render(<BoardCanvas parts={[]} wires={[]} running={false} callbacks={makeCallbacks()} />);
    unmount();
    expect(engine.unmount).toHaveBeenCalledTimes(1);
  });

  it('pushes the doc to the engine on mount and whenever parts/wires/running change', () => {
    const parts = [{ id: 'led-1' }];
    const { rerender } = render(<BoardCanvas parts={parts} wires={[]} running={false} callbacks={makeCallbacks()} />);
    expect(engine.setDoc).toHaveBeenLastCalledWith({ parts, wires: [], running: false });

    const parts2 = [{ id: 'led-2' }];
    rerender(<BoardCanvas parts={parts2} wires={[]} running={true} callbacks={makeCallbacks()} />);
    expect(engine.setDoc).toHaveBeenLastCalledWith({ parts: parts2, wires: [], running: true });
  });

  it('does not recreate the engine when callbacks change identity, but still calls the latest callback', () => {
    const callbacksA = makeCallbacks();
    const { rerender } = render(<BoardCanvas parts={[]} wires={[]} running={false} callbacks={callbacksA} />);
    const stableCallbacks = createBoardEngine.mock.calls[0][1];

    const callbacksB = makeCallbacks();
    rerender(<BoardCanvas parts={[]} wires={[]} running={false} callbacks={callbacksB} />);
    expect(createBoardEngine).toHaveBeenCalledTimes(1);

    stableCallbacks.onAddWire('a', 'b');
    expect(callbacksB.onAddWire).toHaveBeenCalledWith('a', 'b');
    expect(callbacksA.onAddWire).not.toHaveBeenCalled();
  });

  it('forwards every callback through the stable wrapper', () => {
    const callbacks = makeCallbacks();
    render(<BoardCanvas parts={[]} wires={[]} running={false} callbacks={callbacks} />);
    const stable = createBoardEngine.mock.calls[0][1];

    stable.onDeleteWire('w-1');
    expect(callbacks.onDeleteWire).toHaveBeenCalledWith('w-1');
    stable.onDeletePart('p-1');
    expect(callbacks.onDeletePart).toHaveBeenCalledWith('p-1');
    stable.onMovePart('p-1', 10, 20);
    expect(callbacks.onMovePart).toHaveBeenCalledWith('p-1', 10, 20);
    stable.onRotatePart('p-1');
    expect(callbacks.onRotatePart).toHaveBeenCalledWith('p-1');
    stable.onSetPartProp('p-1', 'color', 'blue');
    expect(callbacks.onSetPartProp).toHaveBeenCalledWith('p-1', 'color', 'blue');
    stable.onAddPart('led', 1, 2);
    expect(callbacks.onAddPart).toHaveBeenCalledWith('led', 1, 2);
    stable.onSelectionChange({ kind: 'part', id: 'p-1' });
    expect(callbacks.onSelectionChange).toHaveBeenCalledWith({ kind: 'part', id: 'p-1' });
    stable.onStatus('hello');
    expect(callbacks.onStatus).toHaveBeenCalledWith('hello');
    stable.onLiveResolve();
    expect(callbacks.onLiveResolve).toHaveBeenCalledTimes(1);
  });

  it('tolerates a missing onStatus/onLiveResolve (optional callbacks)', () => {
    const callbacks = makeCallbacks();
    delete callbacks.onStatus;
    delete callbacks.onLiveResolve;
    render(<BoardCanvas parts={[]} wires={[]} running={false} callbacks={callbacks} />);
    const stable = createBoardEngine.mock.calls[0][1];
    expect(() => stable.onStatus('x')).not.toThrow();
    expect(() => stable.onLiveResolve()).not.toThrow();
  });
});
