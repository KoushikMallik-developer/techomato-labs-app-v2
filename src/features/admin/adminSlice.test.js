import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { api } from '@/lib/api';
import adminReducer, {
  bootstrapAdmin,
  adminLogin,
  adminLogout,
  fetchPending,
  approveCircuit,
  rejectCircuit,
  clearAdminError,
  selectIsAdmin,
  selectAdminInitialized,
  selectAdminStatus,
  selectAdminError,
  selectPendingCircuits,
} from './adminSlice';

vi.mock('@/lib/api', () => ({
  api: {
    adminSession: vi.fn(),
    adminLogin: vi.fn(),
    adminLogout: vi.fn(),
    pendingCircuits: vi.fn(),
    approveCircuit: vi.fn(),
    rejectCircuit: vi.fn(),
  },
}));

function makeStore() {
  return configureStore({ reducer: { admin: adminReducer } });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('adminSlice', () => {
  it('starts uninitialized and not-admin', () => {
    const store = makeStore();
    expect(selectAdminInitialized(store.getState())).toBe(false);
    expect(selectIsAdmin(store.getState())).toBe(false);
  });

  it('bootstrapAdmin.fulfilled with isAdmin:true marks the session admin', async () => {
    api.adminSession.mockResolvedValue({ isAdmin: true, email: 'admin@techomato.com' });
    const store = makeStore();
    await store.dispatch(bootstrapAdmin());
    expect(selectAdminInitialized(store.getState())).toBe(true);
    expect(selectIsAdmin(store.getState())).toBe(true);
  });

  it('bootstrapAdmin.fulfilled with isAdmin:false stays not-admin', async () => {
    api.adminSession.mockResolvedValue({ isAdmin: false, email: null });
    const store = makeStore();
    await store.dispatch(bootstrapAdmin());
    expect(selectIsAdmin(store.getState())).toBe(false);
  });

  it('bootstrapAdmin.rejected still marks initialized, not-admin', async () => {
    api.adminSession.mockRejectedValue(new Error('down'));
    const store = makeStore();
    await store.dispatch(bootstrapAdmin());
    expect(selectAdminInitialized(store.getState())).toBe(true);
    expect(selectIsAdmin(store.getState())).toBe(false);
  });

  it('adminLogin.fulfilled flips isAdmin on', async () => {
    api.adminLogin.mockResolvedValue({ email: 'admin@techomato.com' });
    const store = makeStore();
    await store.dispatch(adminLogin({ email: 'admin@techomato.com', password: 'x' }));
    expect(selectIsAdmin(store.getState())).toBe(true);
    expect(selectAdminStatus(store.getState())).toBe('idle');
  });

  it('adminLogin.rejected sets an error and leaves isAdmin false', async () => {
    api.adminLogin.mockRejectedValue(new Error('Invalid admin email or password.'));
    const store = makeStore();
    await store.dispatch(adminLogin({ email: 'admin@techomato.com', password: 'wrong' }));
    expect(selectIsAdmin(store.getState())).toBe(false);
    expect(selectAdminStatus(store.getState())).toBe('failed');
    expect(selectAdminError(store.getState())).toBe('Invalid admin email or password.');
  });

  it('adminLogout.fulfilled flips isAdmin off', async () => {
    api.adminLogin.mockResolvedValue({ email: 'admin@techomato.com' });
    api.adminLogout.mockResolvedValue(undefined);
    const store = makeStore();
    await store.dispatch(adminLogin({ email: 'admin@techomato.com', password: 'x' }));
    await store.dispatch(adminLogout());
    expect(selectIsAdmin(store.getState())).toBe(false);
  });

  it('fetchPending.fulfilled stores the pending list', async () => {
    const pending = [{ id: 'p-1', name: 'Circuit 1' }];
    api.pendingCircuits.mockResolvedValue(pending);
    const store = makeStore();
    await store.dispatch(fetchPending());
    expect(selectPendingCircuits(store.getState())).toEqual(pending);
  });

  it('approveCircuit re-fetches the pending list after approving', async () => {
    api.pendingCircuits.mockResolvedValueOnce([{ id: 'p-1' }, { id: 'p-2' }]).mockResolvedValueOnce([{ id: 'p-2' }]);
    api.approveCircuit.mockResolvedValue(undefined);
    const store = makeStore();
    await store.dispatch(fetchPending());
    expect(selectPendingCircuits(store.getState())).toHaveLength(2);
    await store.dispatch(approveCircuit('p-1'));
    expect(api.approveCircuit).toHaveBeenCalledWith('p-1');
    expect(selectPendingCircuits(store.getState())).toEqual([{ id: 'p-2' }]);
  });

  it('rejectCircuit re-fetches the pending list after rejecting', async () => {
    api.pendingCircuits.mockResolvedValueOnce([{ id: 'p-1' }]).mockResolvedValueOnce([]);
    api.rejectCircuit.mockResolvedValue(undefined);
    const store = makeStore();
    await store.dispatch(fetchPending());
    await store.dispatch(rejectCircuit('p-1'));
    expect(api.rejectCircuit).toHaveBeenCalledWith('p-1');
    expect(selectPendingCircuits(store.getState())).toEqual([]);
  });

  it('clearAdminError resets the error field', async () => {
    api.adminLogin.mockRejectedValue(new Error('nope'));
    const store = makeStore();
    await store.dispatch(adminLogin({ email: 'a', password: 'b' }));
    expect(selectAdminError(store.getState())).toBe('nope');
    store.dispatch(clearAdminError());
    expect(selectAdminError(store.getState())).toBeNull();
  });
});
