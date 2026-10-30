import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import FollowingPanel from './FollowingPanel';

vi.mock('@/lib/api', () => ({
  api: { following: vi.fn(), unfollow: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FollowingPanel', () => {
  it('shows a placeholder when following no one', async () => {
    api.following.mockResolvedValue([]);
    renderWithProviders(<FollowingPanel />);
    await waitFor(() => expect(api.following).toHaveBeenCalled());
    expect(screen.getByText(/aren't following anyone yet/)).toBeInTheDocument();
  });

  it('lists followed handles', async () => {
    api.following.mockResolvedValue(['ada_maker', 'hana_builds']);
    renderWithProviders(<FollowingPanel />);
    expect(await screen.findByText('@ada_maker')).toBeInTheDocument();
    expect(screen.getByText('@hana_builds')).toBeInTheDocument();
  });

  it('unfollows a handle and removes it from the list', async () => {
    api.following.mockResolvedValue(['ada_maker']);
    api.unfollow.mockResolvedValue({ handle: 'ada_maker', following: false });
    renderWithProviders(<FollowingPanel />);
    await screen.findByText('@ada_maker');
    fireEvent.click(screen.getByText('Unfollow'));
    await waitFor(() => expect(api.unfollow).toHaveBeenCalledWith('ada_maker'));
    expect(screen.queryByText('@ada_maker')).not.toBeInTheDocument();
  });
});
