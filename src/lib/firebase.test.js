import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const fb = vi.hoisted(() => ({ initAppCheck: vi.fn() }));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn() }));
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn() }));
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: fb.initAppCheck,
  ReCaptchaV3Provider: class {
    constructor(key) {
      this.key = key;
    }
  },
}));

async function load(recaptchaKey) {
  vi.resetModules();
  vi.stubEnv('VITE_RECAPTCHA_SITE_KEY', recaptchaKey);
  await import('./firebase');
}

beforeEach(() => {
  fb.initAppCheck.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('App Check switch (VITE_RECAPTCHA_SITE_KEY)', () => {
  it('is off when the key is not set', async () => {
    await load(undefined);
    expect(fb.initAppCheck).not.toHaveBeenCalled();
  });

  it('is off when the key is blank or only spaces', async () => {
    await load('');
    await load('   ');
    expect(fb.initAppCheck).not.toHaveBeenCalled();
  });

  it('is on when the key is present (and uses it trimmed)', async () => {
    await load('  site-key  ');
    expect(fb.initAppCheck).toHaveBeenCalledTimes(1);
    expect(fb.initAppCheck.mock.calls[0][1].provider.key).toBe('site-key');
  });
});
