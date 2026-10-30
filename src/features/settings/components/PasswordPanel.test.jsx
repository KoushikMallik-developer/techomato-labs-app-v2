import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import PasswordPanel from './PasswordPanel';
import { selectToast } from '@/features/ui/uiSlice';

vi.mock('@/lib/api', () => ({
  api: { changePassword: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PasswordPanel', () => {
  it('updates the password, clears the fields, and shows a toast', async () => {
    api.changePassword.mockResolvedValue(undefined);
    const { store } = renderWithProviders(<PasswordPanel />);
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'OldPass1!' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByText('Update'));
    await waitFor(() => expect(api.changePassword).toHaveBeenCalledWith({ current: 'OldPass1!', next: 'NewPass1!' }));
    expect(screen.getByLabelText('Current password')).toHaveValue('');
    expect(screen.getByLabelText('New password')).toHaveValue('');
    expect(selectToast(store.getState()).message).toBe('Password updated.');
  });

  it('shows the server error and keeps the fields on failure', async () => {
    api.changePassword.mockRejectedValue(new Error('Current password is incorrect.'));
    renderWithProviders(<PasswordPanel />);
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'wrong' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewPass1!' } });
    fireEvent.click(screen.getByText('Update'));
    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument();
    expect(screen.getByLabelText('Current password')).toHaveValue('wrong');
  });
});
