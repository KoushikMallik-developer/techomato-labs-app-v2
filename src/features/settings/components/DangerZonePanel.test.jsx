import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import DangerZonePanel from './DangerZonePanel';
import { selectModal, selectToast } from '@/features/ui/uiSlice';

vi.mock('@/lib/api', () => ({
  api: { logout: vi.fn(), deleteAccount: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderPanel() {
  return renderWithProviders(
    <Routes>
      <Route path="/settings" element={<DangerZonePanel />} />
      <Route path="/" element={<div>Landing page</div>} />
    </Routes>,
    { route: '/settings' },
  );
}

describe('DangerZonePanel', () => {
  it('signs out and navigates home', async () => {
    api.logout.mockResolvedValue(undefined);
    renderPanel();
    fireEvent.click(screen.getByText('Sign out'));
    await waitFor(() => expect(api.logout).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Landing page')).toBeInTheDocument();
  });

  it('opens a confirm dialog before deleting the account', () => {
    const { store } = renderPanel();
    fireEvent.click(screen.getByText('Delete account'));
    const modal = selectModal(store.getState());
    expect(modal.type).toBe('confirm');
    expect(modal.props.title).toBe('Delete your account?');
  });

  it('confirming delete removes the account and navigates home', async () => {
    api.deleteAccount.mockResolvedValue(undefined);
    const { store } = renderPanel();
    fireEvent.click(screen.getByText('Delete account'));
    const { onConfirm } = selectModal(store.getState()).props;
    await onConfirm();
    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Landing page')).toBeInTheDocument();
  });

  it('stays on the page and says why when the deletion is refused', async () => {
    api.deleteAccount.mockRejectedValue(new Error('For security, log out and back in, then try again.'));
    const { store } = renderPanel();
    fireEvent.click(screen.getByText('Delete account'));
    await selectModal(store.getState()).props.onConfirm();
    expect(selectToast(store.getState()).message).toBe('For security, log out and back in, then try again.');
    expect(screen.queryByText('Landing page')).not.toBeInTheDocument();
  });
});
