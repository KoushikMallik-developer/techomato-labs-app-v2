import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import OAuthButtons from './OAuthButtons';

vi.mock('@/lib/api', () => ({
  api: { oauthProviders: vi.fn(), oauthLogin: vi.fn() },
}));

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig()), useNavigate: () => navigate }));

beforeEach(() => {
  vi.clearAllMocks();
  api.oauthProviders.mockResolvedValue({ google: true, github: true });
});

describe('OAuthButtons', () => {
  it('keeps the buttons disabled until providers load', async () => {
    let resolveProviders;
    api.oauthProviders.mockReturnValue(new Promise((res) => { resolveProviders = res; }));
    renderWithProviders(<OAuthButtons next="/projects" />);
    expect(screen.getByText('Continue with Google').closest('button')).toBeDisabled();
    resolveProviders({ google: true });
    await waitFor(() => expect(screen.getByText('Continue with Google').closest('button')).not.toBeDisabled());
    expect(screen.getByText('Continue with GitHub').closest('button')).toBeDisabled();
  });

  it('disables every button when the disabled prop is set', async () => {
    renderWithProviders(<OAuthButtons next="/projects" disabled />);
    await waitFor(() => expect(api.oauthProviders).toHaveBeenCalled());
    expect(screen.getByText('Continue with Google').closest('button')).toBeDisabled();
  });

  it('signs in with the chosen provider and continues to next when verified', async () => {
    api.oauthLogin.mockResolvedValue({ id: 'u1', verified: true });
    renderWithProviders(<OAuthButtons next="/settings" />);
    const btn = await screen.findByText('Continue with GitHub');
    await waitFor(() => expect(btn.closest('button')).not.toBeDisabled());
    fireEvent.click(btn);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/settings', { replace: true }));
    expect(api.oauthLogin).toHaveBeenCalledWith('github');
  });

  it('sends unverified users to the verify-email page', async () => {
    api.oauthLogin.mockResolvedValue({ id: 'u1', verified: false });
    renderWithProviders(<OAuthButtons next="/settings" />);
    const btn = await screen.findByText('Continue with Google');
    await waitFor(() => expect(btn.closest('button')).not.toBeDisabled());
    fireEvent.click(btn);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/verify-email?next=%2Fsettings', { replace: true }));
  });

  it('stays put when sign-in fails', async () => {
    api.oauthLogin.mockRejectedValue(new Error('Sign-in was cancelled.'));
    renderWithProviders(<OAuthButtons next="/settings" />);
    const btn = await screen.findByText('Continue with Google');
    await waitFor(() => expect(btn.closest('button')).not.toBeDisabled());
    fireEvent.click(btn);
    await waitFor(() => expect(api.oauthLogin).toHaveBeenCalled());
    expect(navigate).not.toHaveBeenCalled();
  });
});
