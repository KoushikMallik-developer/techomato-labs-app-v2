/**
 * Sanitizes a `?next=` redirect target so it can only point somewhere
 * inside this app. Guards against open-redirect payloads like
 * `//evil.com`, `/\evil.com`, or `https://evil.com` (relevant regardless of
 * react-router version — CVE-2025-68470 is one way a raw next-param could
 * be abused, but we don't trust it even patched).
 */
export function sanitizeNext(next, fallback = '/projects') {
  if (typeof next !== 'string' || next.length === 0) return fallback;
  // Must start with exactly one '/', never '//' or '/\' (both browser-navigate to another host).
  if (!/^\/(?!\/|\\)/.test(next)) return fallback;
  return next;
}
