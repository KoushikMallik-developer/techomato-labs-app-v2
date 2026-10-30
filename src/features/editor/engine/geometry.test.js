import { describe, it, expect } from 'vitest';
import {
  clamp,
  snap,
  esc,
  ck,
  byId,
  ard,
  local2world,
  pinPos,
  keyPos,
  holeMap,
  occupiedSet,
  snapPartPos,
  carryFor,
  partsBBox,
  pinLabel,
} from './geometry';

function part(id, type, x, y, rot = 0, props = {}) {
  return { id, type, x, y, rot, props };
}

describe('small pure helpers', () => {
  it('clamp bounds a value within [a,b]', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('snap rounds to the nearest multiple of 5', () => {
    expect(snap(12)).toBe(10);
    expect(snap(13)).toBe(15);
  });

  it('esc escapes HTML-significant characters', () => {
    expect(esc('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });

  it('ck builds a rounded coordinate key', () => {
    expect(ck(1.4, 2.6)).toBe('1,3');
  });

  it('byId finds a part by id, ard finds the arduino', () => {
    const doc = { parts: [part('a', 'led', 0, 0), part('ard-1', 'arduino', 0, 0)] };
    expect(byId(doc, 'a').type).toBe('led');
    expect(byId(doc, 'missing')).toBeUndefined();
    expect(ard(doc).id).toBe('ard-1');
  });
});

describe('local2world', () => {
  it('translates a local offset by position with no rotation', () => {
    expect(local2world({ x: 100, y: 100, rot: 0 }, 10, 20)).toEqual([110, 120]);
  });

  it('rotates 90 degrees', () => {
    const [x, y] = local2world({ x: 0, y: 0, rot: 90 }, 10, 0);
    expect(Math.round(x)).toBe(0);
    expect(Math.round(y)).toBe(10);
  });

  it('rotates 180 degrees', () => {
    const [x, y] = local2world({ x: 0, y: 0, rot: 180 }, 10, 0);
    expect(Math.round(x)).toBe(-10);
    expect(Math.round(y)).toBe(0);
  });
});

describe('pinPos / keyPos', () => {
  it('pinPos resolves a named pin to world coordinates', () => {
    const led = part('led-1', 'led', 100, 100);
    const [x, y] = pinPos(led, 'A');
    expect(x).toBe(105);
    expect(y).toBe(124);
  });

  it('keyPos resolves an "id.pin" key through the document', () => {
    const doc = { parts: [part('led-1', 'led', 100, 100)] };
    expect(keyPos(doc, 'led-1.A')).toEqual([105, 124]);
  });

  it('keyPos returns null for an unknown part or unknown pin', () => {
    const doc = { parts: [part('led-1', 'led', 100, 100)] };
    expect(keyPos(doc, 'nope.A')).toBeNull();
    expect(keyPos(doc, 'led-1.ZZZ')).toBeNull();
  });
});

describe('holeMap / occupiedSet', () => {
  it('holeMap maps every breadboard hole coordinate to "id.pin"', () => {
    const doc = { parts: [part('bb-1', 'breadboard', 0, 0)] };
    const map = holeMap(doc);
    expect(map.size).toBeGreaterThan(0);
    for (const v of map.values()) expect(v.startsWith('bb-1.')).toBe(true);
  });

  it('occupiedSet includes every non-breadboard/arduino part\'s pins, and nothing else', () => {
    const doc = {
      parts: [part('bb-1', 'breadboard', 0, 0), part('ard-1', 'arduino', 0, 0), part('led-1', 'led', 200, 200)],
    };
    const set = occupiedSet(doc);
    const [x, y] = pinPos(doc.parts[2], 'A');
    expect(set.has(ck(x, y))).toBe(true);
    // breadboard/arduino pins themselves are never "occupied" (they're the sockets)
    expect(set.size).toBe(2); // led has 2 pins (A, K)
  });
});

describe('snapPartPos', () => {
  it('snaps an arduino to the 5px grid directly', () => {
    expect(snapPartPos({ type: 'arduino' }, 12, 18)).toEqual([10, 20]);
  });

  it('snaps a breadboard to the 10px grid directly', () => {
    expect(snapPartPos({ type: 'breadboard' }, 14, 26)).toEqual([10, 30]);
  });

  it('snaps a generic part so its first pin lands on a 10px grid intersection', () => {
    const [x, y] = snapPartPos({ type: 'led', rot: 0 }, 13, 13);
    // the LED's "A" pin is offset (5, 24) from its origin; the snap keeps that
    // pin (not the origin) aligned to the 10px grid.
    const [fx, fy] = local2world({ x: 0, y: 0, rot: 0 }, 5, 24);
    expect((x + fx) % 10).toBe(0);
    expect((y + fy) % 10).toBe(0);
  });
});

describe('carryFor', () => {
  it('returns a part whose pin lands exactly on one of the breadboard\'s holes', () => {
    const bb = part('bb-1', 'breadboard', 0, 0);
    const [holeX, holeY] = pinPos(bb, 'a1');
    // Place the LED so its "A" pin (local offset 5,24) sits exactly on that hole.
    const seated = part('led-1', 'led', holeX - 5, holeY - 24);
    const doc = { parts: [bb, seated] };
    const result = carryFor(doc, bb);
    expect(result).toHaveLength(1);
    expect(result[0].part.id).toBe('led-1');
    expect(result[0]).toEqual({ part: seated, dx: seated.x - bb.x, dy: seated.y - bb.y });
  });

  it('does not carry a part that is not seated in any of its holes', () => {
    const bb = part('bb-1', 'breadboard', 0, 0);
    const farAway = part('led-1', 'led', 5000, 5000);
    expect(carryFor({ parts: [bb, farAway] }, bb)).toEqual([]);
  });

  it('returns an empty array when called on a non-breadboard part', () => {
    const led = part('led-1', 'led', 0, 0);
    expect(carryFor({ parts: [led] }, led)).toEqual([]);
  });
});

describe('partsBBox', () => {
  it('returns a default box for an empty document', () => {
    expect(partsBBox({ parts: [] })).toEqual([0, 0, 300, 200]);
  });

  it('grows to encompass every part\'s box', () => {
    const doc = { parts: [part('led-1', 'led', 0, 0), part('bb-1', 'breadboard', 500, 500)] };
    const [x0, y0, x1, y1] = partsBBox(doc);
    expect(x1).toBeGreaterThan(x0);
    expect(y1).toBeGreaterThan(y0);
    expect(x1).toBeGreaterThanOrEqual(500);
  });
});

describe('pinLabel', () => {
  it('returns the raw key for an unknown part', () => {
    expect(pinLabel({ parts: [] }, 'nope.A')).toBe('nope.A');
  });

  it('labels an arduino digital pin', () => {
    const doc = { parts: [part('ard-1', 'arduino', 0, 0)] };
    expect(pinLabel(doc, 'ard-1.D13')).toBe('Arduino pin 13');
  });

  it('labels a breadboard rail', () => {
    const doc = { parts: [part('bb-1', 'breadboard', 0, 0)] };
    const label = pinLabel(doc, 'bb-1.a0');
    expect(label.startsWith('Breadboard')).toBe(true);
  });

  it('labels a generic part pin using its type label + pin name', () => {
    const doc = { parts: [part('led-1', 'led', 0, 0)] };
    expect(pinLabel(doc, 'led-1.A')).toMatch(/^LED /);
  });
});
