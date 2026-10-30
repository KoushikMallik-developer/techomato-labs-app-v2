import { describe, it, expect } from 'vitest';
import { rid, uid } from './id';

describe('rid', () => {
  it('prefixes the generated id', () => {
    expect(rid('w-')).toMatch(/^w-[a-z0-9]+$/);
  });

  it('works with no prefix', () => {
    expect(rid()).toMatch(/^[a-z0-9]+$/);
  });

  it('produces different ids across calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => rid('x-')));
    expect(ids.size).toBe(200);
  });
});

describe('uid', () => {
  it('prefixes the generated id', () => {
    expect(uid('u-')).toMatch(/^u-[a-z0-9]+$/);
  });

  it('produces different ids across calls', () => {
    const ids = new Set(Array.from({ length: 200 }, () => uid('p-')));
    expect(ids.size).toBe(200);
  });
});
