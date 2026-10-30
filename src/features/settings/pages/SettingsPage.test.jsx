import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, authState, signedInUser } from '@/test-utils';
import { api } from '@/lib/api';
import SettingsPage from './SettingsPage';

vi.mock('@/lib/api', () => ({
  api: { following: vi.fn().mockResolvedValue([]) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.following.mockResolvedValue([]);
});

describe('SettingsPage', () => {
  it('renders every settings panel', () => {
    renderWithProviders(<SettingsPage />, { preloadedState: { auth: authState({ user: signedInUser() }) } });
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByText('People you follow')).toBeInTheDocument();
    expect(screen.getByText('Danger zone')).toBeInTheDocument();
  });

  it('renders inside the AppShell with the right page title', () => {
    renderWithProviders(<SettingsPage />, { preloadedState: { auth: authState({ user: signedInUser() }) } });
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument();
  });
});
