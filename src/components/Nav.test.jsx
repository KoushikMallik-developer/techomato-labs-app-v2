import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, signedInUser, authState } from '@/test-utils';
import { api } from '@/lib/api';
import Nav from './Nav';

vi.mock('@/lib/api', () => ({
  api: { logout: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Nav (signed out)', () => {
  it('shows Log in / Sign up and no Projects link', () => {
    renderWithProviders(<Nav active="gallery" />);
    expect(screen.getByText('Log in')).toBeInTheDocument();
    expect(screen.getByText('Sign up')).toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
  });

  it('highlights Community Circuits when active="gallery"', () => {
    renderWithProviders(<Nav active="gallery" />);
    expect(screen.getByText('Community Circuits').className).toContain('on');
  });
});

describe('Nav (signed in)', () => {
  const preloadedState = { auth: authState({ user: signedInUser({ name: 'Ada', email: 'ada@example.com' }) }) };

  it('shows the Projects link and an avatar button instead of Log in/Sign up', () => {
    renderWithProviders(<Nav />, { preloadedState });
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.queryByText('Log in')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Account menu')).toBeInTheDocument();
  });

  it('opens the account menu showing name/email and closes on outside click', () => {
    renderWithProviders(<Nav />, { preloadedState });
    fireEvent.click(screen.getByLabelText('Account menu'));
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument();
  });

  it('signs out and navigates home when "Sign out" is clicked', async () => {
    api.logout.mockResolvedValue(undefined);
    renderWithProviders(<Nav />, { preloadedState, route: '/settings' });
    fireEvent.click(screen.getByLabelText('Account menu'));
    fireEvent.click(screen.getByText('Sign out'));
    await waitFor(() => expect(api.logout).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument());
  });
});
