import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, authState, signedInUser } from '@/test-utils';
import { api } from '@/lib/api';
import VerifyEmailPage from './VerifyEmailPage';

vi.mock('@/lib/api', () => ({
  api: { verifyEmail: vi.fn(), resendVerification: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderAt(route, preloadedState) {
  return renderWithProviders(
    <Routes>
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/login" element={<div>Login page</div>} />
      <Route path="/projects" element={<div>Projects page</div>} />
    </Routes>,
    { route, preloadedState },
  );
}

describe('VerifyEmailPage — no token (idle state)', () => {
  it('signed out: points back to /login', () => {
    renderAt('/verify-email');
    expect(screen.getByText('Verify your email')).toBeInTheDocument();
    expect(screen.getByText('Back to log in')).toHaveAttribute('href', '/login');
  });

  it('signed in, unverified: offers resend + skip, and resend calls the API', async () => {
    api.resendVerification.mockResolvedValue({ sent: true });
    renderAt('/verify-email?next=%2Fprojects', {
      auth: authState({ user: signedInUser({ verified: false, email: 'ada@example.com' }) }),
    });
    expect(screen.getByText('We sent a link to ada@example.com.')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Resend link'));
    await waitFor(() => expect(screen.getByText('Link resent — check your inbox.')).toBeInTheDocument());
    expect(screen.getByText('Resend link')).toBeDisabled();
    expect(screen.getByText('Skip for now')).toHaveAttribute('href', '/projects');
  });

  it('signed in, already verified: shows the verified state directly', () => {
    renderAt('/verify-email?next=%2Fprojects', { auth: authState({ user: signedInUser({ verified: true }) }) });
    expect(screen.getByText('Email verified')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });
});

describe('VerifyEmailPage — with a token', () => {
  it('shows a checking state, then success', async () => {
    let resolveVerify;
    api.verifyEmail.mockReturnValue(new Promise((res) => { resolveVerify = res; }));
    renderAt('/verify-email?token=abc123');
    expect(screen.getByText('Verifying your email…')).toBeInTheDocument();
    resolveVerify({ id: 'u-1', email: 'a@b.com', verified: true });
    expect(await screen.findByText('Email verified')).toBeInTheDocument();
  });

  it('shows a failure state with the server message for a bad token', async () => {
    api.verifyEmail.mockRejectedValue(new Error('That verification link is invalid or already used.'));
    renderAt('/verify-email?token=bad-token');
    expect(await screen.findByText("That link didn't work")).toBeInTheDocument();
    expect(screen.getByText('That verification link is invalid or already used.')).toBeInTheDocument();
  });

  it('failure state (signed out) offers a Log in link', async () => {
    api.verifyEmail.mockRejectedValue(new Error('invalid'));
    renderAt('/verify-email?token=bad-token');
    await screen.findByText("That link didn't work");
    expect(screen.getByText('Log in')).toHaveAttribute('href', '/login');
  });

  it('failure state (signed in) offers a resend button instead', async () => {
    api.verifyEmail.mockRejectedValue(new Error('invalid'));
    api.resendVerification.mockResolvedValue({ sent: true });
    renderAt('/verify-email?token=bad-token', { auth: authState({ user: signedInUser({ verified: false }) }) });
    await screen.findByText("That link didn't work");
    fireEvent.click(screen.getByText('Send a new link'));
    await waitFor(() => expect(screen.getByText('New link sent')).toBeInTheDocument());
  });

  it('clicking Continue (signed in, verified) navigates to next', async () => {
    api.verifyEmail.mockResolvedValue({ id: 'u-1', email: 'a@b.com', verified: true });
    renderAt('/verify-email?token=abc123&next=%2Fprojects', { auth: authState({ user: signedInUser({ verified: false }) }) });
    fireEvent.click(await screen.findByText('Continue'));
    expect(await screen.findByText('Projects page')).toBeInTheDocument();
  });
});
