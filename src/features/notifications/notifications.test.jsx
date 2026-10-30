import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, authState, signedInUser } from '@/test-utils';
import { api } from '@/lib/api';
import NotificationsPage from './pages/NotificationsPage';

vi.mock('@/lib/api', () => ({
  api: { notifications: vi.fn(), markNotificationsRead: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const items = [
  { id: 'like_p1_u2', type: 'like', from: 'bob_2', targetId: 'p1', text: 'Blink', read: false, createdAt: 2 },
  { id: 'reply_x', type: 'reply', from: 'cy_3', targetId: 't1', text: 'Same here', read: true, createdAt: 1 },
];

describe('NotificationsPage', () => {
  it('lists notifications with links, shows the unread count in the menu, and marks them read', async () => {
    api.notifications.mockResolvedValue(items);
    api.markNotificationsRead.mockImplementation(async (ids) => ids);
    renderWithProviders(<NotificationsPage />, { preloadedState: { auth: authState({ user: signedInUser() }) } });

    const like = await screen.findByText('liked your circuit', { exact: false });
    expect(like.closest('a')).toHaveAttribute('href', '/community/p1');
    expect(screen.getByText('replied in a discussion', { exact: false }).closest('a')).toHaveAttribute('href', '/discussions/t1');
    expect(screen.getAllByLabelText('1 unread').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText('Mark all as read'));
    await waitFor(() => expect(api.markNotificationsRead).toHaveBeenCalledWith(['like_p1_u2']));
    await waitFor(() => expect(screen.queryByLabelText('1 unread')).not.toBeInTheDocument());
    expect(screen.queryByText('Mark all as read')).not.toBeInTheDocument();
  });

  it('says when there is nothing yet', async () => {
    api.notifications.mockResolvedValue([]);
    renderWithProviders(<NotificationsPage />, { preloadedState: { auth: authState({ user: signedInUser() }) } });
    expect(await screen.findByText('All quiet')).toBeInTheDocument();
  });
});
