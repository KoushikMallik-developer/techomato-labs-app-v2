import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import SignupPage from './SignupPage';

vi.mock('@/lib/api', () => ({
  api: { signup: vi.fn(), oauthProviders: vi.fn().mockResolvedValue({}) },
}));

beforeEach(() => {
  vi.clearAllMocks();
  api.oauthProviders.mockResolvedValue({});
});

function renderSignup(route = '/signup') {
  return renderWithProviders(
    <Routes>
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<div>Verify email page</div>} />
    </Routes>,
    { route },
  );
}

describe('SignupPage', () => {
  it('renders the form and a link to log in', () => {
    renderSignup();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByText('Log in')).toHaveAttribute('href', '/login');
  });

  it('shows a password strength meter as the password is typed', () => {
    renderSignup();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Sup3r$ecure!' } });
    expect(screen.getByText(/too short|weak|fair|good|strong/i)).toBeInTheDocument();
  });

  it('navigates to /verify-email (carrying next) on a successful signup', async () => {
    api.signup.mockResolvedValue({ id: 'u-1', email: 'a@b.com', verified: false });
    renderSignup('/signup?next=%2Fsettings');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Verify email page')).toBeInTheDocument();
  });

  it('shows a server-side validation error and does not navigate', async () => {
    api.signup.mockRejectedValue(new Error('An account with that email already exists.'));
    renderSignup();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with that email already exists.');
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });

  it('disables the submit button while submitting', async () => {
    let resolveSignup;
    api.signup.mockReturnValue(new Promise((res) => { resolveSignup = res; }));
    renderSignup();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough1' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText('Creating account…')).toBeInTheDocument();
    resolveSignup({ id: 'u-1', email: 'a@b.com', verified: false });
    await waitFor(() => expect(screen.getByText('Verify email page')).toBeInTheDocument());
  });
});
