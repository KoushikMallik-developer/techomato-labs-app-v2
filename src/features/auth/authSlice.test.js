import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/lib/api';
import authReducer, {
  bootstrapAuth,
  signup,
  login,
  logout,
  oauthLogin,
  fetchOAuthProviders,
  updateProfile,
  deleteAccount,
  verifyEmail,
  clearError,
  selectUser,
  selectIsSignedIn,
  selectAuthInitialized,
  selectAuthStatus,
  selectAuthError,
  selectOAuthProviders,
} from './authSlice';

vi.mock('@/lib/api', () => ({
  api: {
    me: vi.fn(),
    signup: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    oauthProviders: vi.fn(),
    oauthLogin: vi.fn(),
    updateMe: vi.fn(),
    deleteAccount: vi.fn(),
    verifyEmail: vi.fn(),
  },
}));

function makeStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authSlice', () => {
  it('starts uninitialized and signed out', () => {
    const store = makeStore();
    expect(selectAuthInitialized(store.getState())).toBe(false);
    expect(selectIsSignedIn(store.getState())).toBe(false);
    expect(selectUser(store.getState())).toBeNull();
  });

  it('bootstrapAuth.fulfilled marks initialized and sets the signed-in user', async () => {
    const user = { id: 'u-1', email: 'a@b.com', verified: true };
    api.me.mockResolvedValue(user);
    const store = makeStore();
    await store.dispatch(bootstrapAuth());
    expect(selectAuthInitialized(store.getState())).toBe(true);
    expect(selectUser(store.getState())).toEqual(user);
    expect(selectIsSignedIn(store.getState())).toBe(true);
  });

  it('bootstrapAuth still marks initialized when there is no session (api.me resolves null)', async () => {
    api.me.mockResolvedValue(null);
    const store = makeStore();
    await store.dispatch(bootstrapAuth());
    expect(selectAuthInitialized(store.getState())).toBe(true);
    expect(selectIsSignedIn(store.getState())).toBe(false);
  });

  it('bootstrapAuth.rejected (network error) still marks initialized, signed out', async () => {
    api.me.mockRejectedValue(new Error('network down'));
    const store = makeStore();
    await store.dispatch(bootstrapAuth());
    expect(selectAuthInitialized(store.getState())).toBe(true);
    expect(selectIsSignedIn(store.getState())).toBe(false);
  });

  it('login.pending sets status to loading and clears a previous error', async () => {
    let resolveLogin;
    api.login.mockReturnValue(new Promise((res) => { resolveLogin = res; }));
    const store = makeStore();
    const promise = store.dispatch(login({ email: 'a@b.com', password: 'x' }));
    expect(selectAuthStatus(store.getState())).toBe('loading');
    resolveLogin({ id: 'u-1', email: 'a@b.com' });
    await promise;
  });

  it('login.fulfilled sets the user and resets status', async () => {
    const user = { id: 'u-1', email: 'a@b.com' };
    api.login.mockResolvedValue(user);
    const store = makeStore();
    await store.dispatch(login({ email: 'a@b.com', password: 'x' }));
    expect(selectUser(store.getState())).toEqual(user);
    expect(selectAuthStatus(store.getState())).toBe('idle');
  });

  it('login.rejected sets status failed and stores the error message', async () => {
    api.login.mockRejectedValue(new Error('Email or password is incorrect.'));
    const store = makeStore();
    await store.dispatch(login({ email: 'a@b.com', password: 'wrong' }));
    expect(selectAuthStatus(store.getState())).toBe('failed');
    expect(selectAuthError(store.getState())).toBe('Email or password is incorrect.');
    expect(selectUser(store.getState())).toBeNull();
  });

  it('signup.fulfilled signs the user in', async () => {
    const user = { id: 'u-2', email: 'new@b.com', verified: false };
    api.signup.mockResolvedValue(user);
    const store = makeStore();
    await store.dispatch(signup({ name: 'New', email: 'new@b.com', password: 'longpass1' }));
    expect(selectUser(store.getState())).toEqual(user);
  });

  it('oauthLogin.fulfilled signs the user in the same way as login', async () => {
    const user = { id: 'u-3', email: 'oauth@b.com', verified: true };
    api.oauthLogin.mockResolvedValue(user);
    const store = makeStore();
    await store.dispatch(oauthLogin({ provider: 'google', code: 'c', redirectUri: 'r' }));
    expect(selectUser(store.getState())).toEqual(user);
  });

  it('fetchOAuthProviders.fulfilled stores the provider map', async () => {
    api.oauthProviders.mockResolvedValue({ google: 'client-id-1' });
    const store = makeStore();
    await store.dispatch(fetchOAuthProviders());
    expect(selectOAuthProviders(store.getState())).toEqual({ google: 'client-id-1' });
  });

  it('logout.fulfilled clears the user and resets status/error', async () => {
    api.login.mockResolvedValue({ id: 'u-1', email: 'a@b.com' });
    api.logout.mockResolvedValue(undefined);
    const store = makeStore();
    await store.dispatch(login({ email: 'a@b.com', password: 'x' }));
    expect(selectIsSignedIn(store.getState())).toBe(true);
    await store.dispatch(logout());
    expect(selectIsSignedIn(store.getState())).toBe(false);
    expect(selectAuthError(store.getState())).toBeNull();
  });

  it('updateProfile.fulfilled replaces the user record', async () => {
    api.login.mockResolvedValue({ id: 'u-1', email: 'a@b.com', name: 'Old Name' });
    api.updateMe.mockResolvedValue({ id: 'u-1', email: 'a@b.com', name: 'New Name' });
    const store = makeStore();
    await store.dispatch(login({ email: 'a@b.com', password: 'x' }));
    await store.dispatch(updateProfile({ name: 'New Name' }));
    expect(selectUser(store.getState()).name).toBe('New Name');
  });

  it('deleteAccount.fulfilled clears the user', async () => {
    api.login.mockResolvedValue({ id: 'u-1', email: 'a@b.com' });
    api.deleteAccount.mockResolvedValue(undefined);
    const store = makeStore();
    await store.dispatch(login({ email: 'a@b.com', password: 'x' }));
    await store.dispatch(deleteAccount());
    expect(selectUser(store.getState())).toBeNull();
  });

  it("verifyEmail.fulfilled updates the current user's record when ids match", async () => {
    api.login.mockResolvedValue({ id: 'u-1', email: 'a@b.com', verified: false });
    api.verifyEmail.mockResolvedValue({ id: 'u-1', email: 'a@b.com', verified: true });
    const store = makeStore();
    await store.dispatch(login({ email: 'a@b.com', password: 'x' }));
    await store.dispatch(verifyEmail('some-token'));
    expect(selectUser(store.getState()).verified).toBe(true);
  });

  it("verifyEmail.fulfilled ignores a result for a different user", async () => {
    api.login.mockResolvedValue({ id: 'u-1', email: 'a@b.com', verified: false });
    api.verifyEmail.mockResolvedValue({ id: 'someone-else', email: 'x@y.com', verified: true });
    const store = makeStore();
    await store.dispatch(login({ email: 'a@b.com', password: 'x' }));
    await store.dispatch(verifyEmail('some-token'));
    expect(selectUser(store.getState()).verified).toBe(false);
  });

  it('clearError resets the error field', async () => {
    api.login.mockRejectedValue(new Error('nope'));
    const store = makeStore();
    await store.dispatch(login({ email: 'a@b.com', password: 'x' }));
    expect(selectAuthError(store.getState())).toBe('nope');
    store.dispatch(clearError());
    expect(selectAuthError(store.getState())).toBeNull();
  });
});
