import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders, authState, signedInUser } from '@/test-utils';
import { api } from '@/lib/api';
import ProfilePanel from './ProfilePanel';
import { selectToast } from '@/features/ui/uiSlice';

vi.mock('@/lib/api', () => ({
  api: { updateMe: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderPanel(user = signedInUser()) {
  return renderWithProviders(<ProfilePanel />, { preloadedState: { auth: authState({ user }) } });
}

describe('ProfilePanel', () => {
  it('pre-fills the current name', () => {
    renderPanel(signedInUser({ name: 'Ada' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Ada');
  });

  it('shows a verify-email prompt when unverified', () => {
    renderPanel(signedInUser({ verified: false }));
    expect(screen.getByText('Verify it')).toHaveAttribute('href', '/verify-email');
  });

  it('shows no verify-email prompt when verified', () => {
    renderPanel(signedInUser({ verified: true }));
    expect(screen.queryByText('Verify it')).not.toBeInTheDocument();
  });

  it('saves the trimmed name and shows a toast', async () => {
    api.updateMe.mockResolvedValue(signedInUser({ name: 'Ada Renamed' }));
    const { store } = renderPanel(signedInUser({ name: 'Ada' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Ada Renamed  ' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(api.updateMe).toHaveBeenCalledWith({ name: 'Ada Renamed' }));
    expect(selectToast(store.getState()).message).toBe('Profile updated.');
  });

  it('falls back to the existing name if the field is cleared', async () => {
    api.updateMe.mockResolvedValue(signedInUser({ name: 'Ada' }));
    renderPanel(signedInUser({ name: 'Ada' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(api.updateMe).toHaveBeenCalledWith({ name: 'Ada' }));
  });

  it('picks an avatar and highlights it once saved', async () => {
    const user = signedInUser({ avatar: null });
    api.updateMe.mockResolvedValue({ ...user, avatar: '\u{1F916}' });
    renderPanel(user);
    fireEvent.click(screen.getByLabelText('Use \u{1F916} as avatar'));
    await waitFor(() => expect(api.updateMe).toHaveBeenCalledWith({ avatar: '\u{1F916}' }));
  });
});
