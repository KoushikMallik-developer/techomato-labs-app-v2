import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import ResetPasswordPage from './ResetPasswordPage';

vi.mock('@/lib/api', () => ({
  api: { resetPassword: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderAt(route) {
  return renderWithProviders(
    <Routes>
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/login" element={<div>Login page</div>} />
    </Routes>,
    { route },
  );
}

describe('ResetPasswordPage', () => {
  it('shows an "invalid link" message when there is no token', () => {
    renderAt('/reset-password');
    expect(screen.getByText('Invalid link')).toBeInTheDocument();
    expect(screen.getByText('Request a new one')).toHaveAttribute('href', '/forgot');
  });

  it('renders the form when a token is present', () => {
    renderAt('/reset-password?token=abc123');
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
  });

  it('shows a client-side error when the passwords do not match, without calling the API', () => {
    renderAt('/reset-password?token=abc123');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different123' } });
    fireEvent.click(screen.getByText('Update password'));
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('navigates to /login on success', async () => {
    api.resetPassword.mockResolvedValue(undefined);
    renderAt('/reset-password?token=abc123');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByText('Update password'));
    expect(await screen.findByText('Login page')).toBeInTheDocument();
    expect(api.resetPassword).toHaveBeenCalledWith({ token: 'abc123', password: 'Password123' });
  });

  it('shows the server error for an invalid/expired token and stays put', async () => {
    api.resetPassword.mockRejectedValue(new Error('That reset link is invalid or has expired.'));
    renderAt('/reset-password?token=stale-token');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByText('Update password'));
    expect(await screen.findByText('That reset link is invalid or has expired.')).toBeInTheDocument();
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('clears a stale mismatch error once the passwords are fixed and resubmitted', async () => {
    api.resetPassword.mockResolvedValue(undefined);
    renderAt('/reset-password?token=abc123');
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Password123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Nope' } });
    fireEvent.click(screen.getByText('Update password'));
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Password123' } });
    fireEvent.click(screen.getByText('Update password'));
    await waitFor(() => expect(screen.queryByText('Passwords do not match.')).not.toBeInTheDocument());
  });
});
