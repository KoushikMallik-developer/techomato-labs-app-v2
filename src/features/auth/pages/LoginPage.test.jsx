import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import LoginPage from './LoginPage';

vi.mock('@/lib/api', () => ({
  api: { login: vi.fn(), oauthProviders: vi.fn().mockResolvedValue({}) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.oauthProviders.mockResolvedValue({});
});

function renderLogin(route = '/login') {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<div>Verify email page</div>} />
      <Route path="/projects" element={<div>Projects page</div>} />
      <Route path="/settings" element={<div>Settings page</div>} />
    </Routes>,
    { route },
  );
}

describe('LoginPage', () => {
  it('renders the form and a link to sign up', () => {
    renderLogin();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByText('Create an account')).toHaveAttribute('href', '/signup');
    expect(screen.getByText('Forgot password?')).toHaveAttribute('href', '/forgot');
  });

  it('shows an error and stays put on invalid credentials', async () => {
    api.login.mockRejectedValue(new Error('Email or password is incorrect.'));
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('navigates to /verify-email when logging in as an unverified user', async () => {
    api.login.mockResolvedValue({ id: 'u-1', email: 'a@b.com', verified: false });
    renderLogin('/login?next=%2Fsettings');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('Verify email page')).toBeInTheDocument();
  });

  it('navigates to next (default /projects) when logging in as a verified user', async () => {
    api.login.mockResolvedValue({ id: 'u-1', email: 'a@b.com', verified: true });
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('Projects page')).toBeInTheDocument();
  });

  it('honors the ?next= redirect target for a verified login', async () => {
    api.login.mockResolvedValue({ id: 'u-1', email: 'a@b.com', verified: true });
    renderLogin('/login?next=%2Fsettings');
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('Settings page')).toBeInTheDocument();
  });

  it('disables the submit button and shows a spinner while submitting', async () => {
    let resolveLogin;
    api.login.mockReturnValue(new Promise((res) => { resolveLogin = res; }));
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('Logging in…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
    resolveLogin({ id: 'u-1', email: 'a@b.com', verified: true });
    await waitFor(() => expect(screen.getByText('Projects page')).toBeInTheDocument());
  });

  it('clears a previous error on a new submit attempt', async () => {
    api.login.mockRejectedValueOnce(new Error('Email or password is incorrect.'));
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    api.login.mockResolvedValueOnce({ id: 'u-1', email: 'a@b.com', verified: true });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
});
