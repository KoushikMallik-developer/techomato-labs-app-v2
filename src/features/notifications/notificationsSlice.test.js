import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeTestStore } from '@/test-utils';
import { api } from '@/lib/api';
import { deleteAccount } from '@/features/auth/authSlice';
import { fetchNotifications, selectUnreadCount } from './notificationsSlice';

vi.mock('@/lib/api', () => ({ api: { notifications: vi.fn(), deleteAccount: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('notificationsSlice', () => {
  it('asks once even when two parts of the page ask at the same time', async () => {
    api.notifications.mockResolvedValue([{ id: 'n1', read: false }]);
    const store = makeTestStore();
    await Promise.all([store.dispatch(fetchNotifications()), store.dispatch(fetchNotifications())]);
    expect(api.notifications).toHaveBeenCalledTimes(1);
    expect(selectUnreadCount(store.getState())).toBe(1);
  });

  it('forgets the notifications of a deleted account', async () => {
    api.notifications.mockResolvedValue([{ id: 'n1', read: false }]);
    api.deleteAccount.mockResolvedValue();
    const store = makeTestStore();
    await store.dispatch(fetchNotifications());
    await store.dispatch(deleteAccount());
    expect(store.getState().notifications).toEqual({ items: [], status: 'idle' });
  });
});
