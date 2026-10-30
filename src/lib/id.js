/** Random base36 id, optionally prefixed (e.g. `rid('w')` for a wire id). */
export function rid(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 9);
}

/** Id with a timestamp suffix, used for top-level records (users, projects). */
export function uid(prefix = '') {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
