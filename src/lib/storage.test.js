import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

async function freshStorageModule() {
  vi.resetModules();
  return import('./storage');
}

describe('storage (localStorage available)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns the fallback when a key is missing', async () => {
    const { storage } = await freshStorageModule();
    expect(storage.get('missing-key', 'fallback')).toBe('fallback');
  });

  it('round-trips a JSON-serializable value', async () => {
    const { storage } = await freshStorageModule();
    storage.set('k', { a: 1, b: [1, 2, 3] });
    expect(storage.get('k', null)).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it('removes a key', async () => {
    const { storage } = await freshStorageModule();
    storage.set('k', 'v');
    storage.remove('k');
    expect(storage.get('k', 'fallback')).toBe('fallback');
  });

  it('falls back on corrupted JSON already in storage', async () => {
    localStorage.setItem('vl.broken', '{not json');
    const { storage } = await freshStorageModule();
    expect(storage.get('vl.broken', 'fallback')).toBe('fallback');
  });
});

describe('storage (localStorage unavailable)', () => {
  let originalDescriptor;

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('disabled');
        },
        setItem: () => {
          throw new Error('disabled');
        },
        removeItem: () => {
          throw new Error('disabled');
        },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', originalDescriptor);
  });

  it('degrades to an in-memory fallback instead of throwing', async () => {
    const { storage } = await freshStorageModule();
    expect(storage.get('k', 'fallback')).toBe('fallback');
    storage.set('k', 'value');
    expect(storage.get('k', 'fallback')).toBe('value');
    storage.remove('k');
    expect(storage.get('k', 'fallback')).toBe('fallback');
  });
});
