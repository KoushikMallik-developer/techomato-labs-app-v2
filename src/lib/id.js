/** Random base36 id, optionally prefixed (e.g. `rid('w')` for a wire id). */
export function rid(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 9);
}
