import { describe, it, expect } from 'vitest';
import { sanitizeNext } from './url';

describe('sanitizeNext', () => {
  it('passes through a normal in-app path', () => {
    expect(sanitizeNext('/community/seed-parking')).toBe('/community/seed-parking');
  });

  it('keeps a query string', () => {
    expect(sanitizeNext('/login?next=%2Fprojects')).toBe('/login?next=%2Fprojects');
  });

  it('falls back on non-string input', () => {
    expect(sanitizeNext(null)).toBe('/projects');
    expect(sanitizeNext(undefined)).toBe('/projects');
    expect(sanitizeNext(42)).toBe('/projects');
  });

  it('falls back on an empty string', () => {
    expect(sanitizeNext('')).toBe('/projects');
  });

  it('rejects protocol-relative URLs (//evil.com)', () => {
    expect(sanitizeNext('//evil.com')).toBe('/projects');
  });

  it('rejects backslash variants (/\\evil.com)', () => {
    expect(sanitizeNext('/\\evil.com')).toBe('/projects');
  });

  it('rejects absolute URLs with a scheme', () => {
    expect(sanitizeNext('https://evil.com')).toBe('/projects');
    expect(sanitizeNext('javascript:alert(1)')).toBe('/projects');
  });

  it('rejects a path with no leading slash', () => {
    expect(sanitizeNext('projects')).toBe('/projects');
  });

  it('honors a custom fallback', () => {
    expect(sanitizeNext(null, '/login')).toBe('/login');
    expect(sanitizeNext('//evil.com', '/login')).toBe('/login');
  });
});
