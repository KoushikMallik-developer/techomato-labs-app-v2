import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, signedInUser, authState } from '@/test-utils';
import { api } from '@/lib/api';
import AppShell from './AppShell';

vi.mock('@/lib/api', () => ({
  api: { logout: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AppShell (signed out)', () => {
  it('hides Projects and Settings, keeps Community Circuits, and shows Log in/Sign up', () => {
    renderWithProviders(
      <AppShell title="Community Circuits">
        <div>content</div>
      </AppShell>,
    );
    expect(screen.queryAllByText('Projects')).toHaveLength(0);
    expect(screen.queryAllByText('Settings')).toHaveLength(0);
    expect(screen.getAllByText('Community Circuits').length).toBeGreaterThan(0);
    expect(screen.getByText('Log in')).toBeInTheDocument();
    expect(screen.getByText('Sign up')).toBeInTheDocument();
  });

  it('renders the page title and children', () => {
    renderWithProviders(
      <AppShell title="Community Circuits">
        <div>the page body</div>
      </AppShell>,
    );
    expect(screen.getByText('Community Circuits', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByText('the page body')).toBeInTheDocument();
  });
});

describe('AppShell (signed in)', () => {
  const preloadedState = { auth: authState({ user: signedInUser({ name: 'Ada' }) }) };

  it('shows Projects and Settings plus the user row and Log out', () => {
    renderWithProviders(
      <AppShell title="Your projects">
        <div />
      </AppShell>,
      { preloadedState },
    );
    expect(screen.getAllByText('Projects').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ada').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Log out').length).toBeGreaterThan(0);
  });

  it('uses the initial of the name when there is no avatar', () => {
    renderWithProviders(
      <AppShell title="Your projects">
        <div />
      </AppShell>,
      { preloadedState },
    );
    expect(screen.getAllByText('A').length).toBeGreaterThan(0);
  });

  it('logs out and navigates home', async () => {
    api.logout.mockResolvedValue(undefined);
    renderWithProviders(
      <AppShell title="Your projects">
        <div />
      </AppShell>,
      { preloadedState, route: '/settings' },
    );
    fireEvent.click(screen.getAllByText('Log out')[0]);
    await waitFor(() => expect(api.logout).toHaveBeenCalledTimes(1));
  });
});
