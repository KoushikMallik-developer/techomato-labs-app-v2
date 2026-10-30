import { describe, it, expect } from 'vitest';
import { sanitizeCircuit } from './sanitizeCircuit';

describe('sanitizeCircuit', () => {
  it('keeps a normal circuit untouched', () => {
    const parts = [{ id: 'led1', type: 'led', x: 10, y: 20, rot: 90, props: { color: 'red' } }];
    const wires = [{ id: 'w-abc', a: 'led1.A', b: 'led1.K', color: '#ffd166' }];
    expect(sanitizeCircuit(parts, wires)).toEqual({ parts, wires });
  });

  it('neutralises markup injection and unknown parts', () => {
    const { parts, wires } = sanitizeCircuit(
      [
        { id: 'a', type: 'led', x: '"><script>', y: 1, props: { color: 'red"/><image onerror=x' } },
        { id: 'b', type: '__proto__' },
        { id: 'c"', type: 'led' },
      ],
      [{ id: 'w1', a: 'a.A', b: 'a.K', color: 'red" onload="x' }, { id: 'w2"', a: 'a.A', b: 'a.K' }],
    );
    expect(parts).toHaveLength(1);
    expect(parts[0].x).toBe(0);
    expect(parts[0].props).toEqual({});
    expect(wires).toHaveLength(1);
    expect(wires[0].color).toBe('#ffd166');
  });

  it('survives non-array input', () => {
    expect(sanitizeCircuit(null, 'x')).toEqual({ parts: [], wires: [] });
  });
});
