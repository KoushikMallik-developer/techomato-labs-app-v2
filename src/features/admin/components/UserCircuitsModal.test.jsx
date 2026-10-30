import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import UserCircuitsModal from './UserCircuitsModal';

vi.mock('@/lib/api', () => ({ api: { adminUserCircuits: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
});

const user = { id: 'u1', handle: 'ada' };

describe('UserCircuitsModal', () => {
  it('lists the circuits the user published, each linking to its page', async () => {
    api.adminUserCircuits.mockResolvedValue([{ id: 'g-1', name: 'Blink', tags: ['leds'], likeCount: 3 }]);
    renderWithProviders(<UserCircuitsModal user={user} close={() => {}} />);
    const link = await screen.findByRole('link', { name: /Blink/ });
    expect(link).toHaveAttribute('href', '/community/g-1');
    expect(api.adminUserCircuits).toHaveBeenCalledWith('u1');
  });

  it('says so when nothing is published', async () => {
    api.adminUserCircuits.mockResolvedValue([]);
    renderWithProviders(<UserCircuitsModal user={user} close={() => {}} />);
    await waitFor(() => expect(screen.getByText('Nothing published.')).toBeInTheDocument());
  });
});
