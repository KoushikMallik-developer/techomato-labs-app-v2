import '@testing-library/jest-dom/vitest';

// No backend is running in tests — stub fetch so api.js's bootstrap calls
// (GET /auth/me/, GET /admin/session/) resolve as "signed out" instead of
// hanging or throwing a network error.
globalThis.fetch = async () =>
  new Response(JSON.stringify({ detail: 'Not authenticated.', code: 'not_authenticated' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
