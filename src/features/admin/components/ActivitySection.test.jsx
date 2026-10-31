import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import ActivitySection from './ActivitySection';

vi.mock('@/lib/api', () => ({ api: { adminActivity: vi.fn() } }));

const data = {
  edges: [0, 1, 2, 3],
  users: [1, 2, 0],
  circuits: [0, 0, 4],
  posts: [50, 0, 0],
  caps: { users: 100, circuits: 100, posts: 50 },
};

describe('ActivitySection', () => {
  it('shows totals per series, marks a capped one, and reloads for another range', async () => {
    api.adminActivity.mockResolvedValue(data);
    renderWithProviders(<ActivitySection />);
    expect(await screen.findByRole('img', { name: 'Users: 3 in total' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Circuits shared: 4 in total' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Discussion posts: 50+ in total' })).toBeInTheDocument(); // at the 50 cap
    expect(api.adminActivity).toHaveBeenLastCalledWith('7d');

    fireEvent.click(screen.getByText('Last 24 hours'));
    await waitFor(() => expect(api.adminActivity).toHaveBeenLastCalledWith('24h'));
  });

  it('says so when the counts cannot be loaded', async () => {
    api.adminActivity.mockRejectedValue(new Error('denied'));
    renderWithProviders(<ActivitySection />);
    expect(await screen.findByText('Could not load the activity counts.')).toBeInTheDocument();
  });
});
