import { describe, it, expect, vi, beforeEach } from 'vitest';

const fb = vi.hoisted(() => ({
  auth: { currentUser: null, authStateReady: () => Promise.resolve() },
  signIn: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/lib/firebase', () => ({ auth: fb.auth, db: {} }));
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: fb.signIn,
  createUserWithEmailAndPassword: fb.create,
  EmailAuthProvider: {},
  GoogleAuthProvider: class {},
  GithubAuthProvider: class {},
}));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), collection: vi.fn(), query: vi.fn(), where: vi.fn(), getDocs: vi.fn() }));

import { api } from './api';

beforeEach(() => {
  vi.clearAllMocks();
  fb.auth.currentUser = null;
});

describe('api (Firebase)', () => {
  it('me() is null when nobody is signed in', async () => {
    expect(await api.me()).toBeNull();
  });

  it('rejects short passwords before touching Firebase', async () => {
    await expect(api.signup({ name: 'Ada', email: 'a@b.com', password: 'short' })).rejects.toThrow(
      'Password must be at least 8 characters.',
    );
    expect(fb.create).not.toHaveBeenCalled();
  });

  it('turns Firebase credential errors into a friendly message and code', async () => {
    fb.signIn.mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/invalid-credential' }));
    await expect(api.login({ email: 'a@b.com', password: 'whatever1' })).rejects.toMatchObject({
      message: 'Email or password is incorrect.',
      code: 'invalid_credentials',
    });
  });

  it('requires sign-in for per-user data', async () => {
    await expect(api.projects()).rejects.toMatchObject({ code: 'not_authenticated' });
  });
});
