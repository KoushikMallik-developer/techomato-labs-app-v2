/**
 * Thin JSON wrapper around localStorage. Every read/write is try/caught so a
 * disabled or full localStorage (private browsing, quota) degrades to
 * in-memory defaults instead of throwing.
 */
const memoryFallback = new Map();

function hasLocalStorage() {
  try {
    const key = '__vl_probe__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

const available = typeof window !== 'undefined' && hasLocalStorage();

export const storage = {
  get(key, fallback) {
    try {
      if (!available) return memoryFallback.has(key) ? memoryFallback.get(key) : fallback;
      const raw = window.localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (!available) {
        memoryFallback.set(key, value);
        return;
      }
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota / serialization errors — caller keeps working with stale data
    }
  },
  remove(key) {
    try {
      if (!available) {
        memoryFallback.delete(key);
        return;
      }
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
