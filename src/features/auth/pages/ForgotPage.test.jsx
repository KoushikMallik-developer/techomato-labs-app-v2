import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import ForgotPage from './ForgotPage';

vi.mock('@/lib/api', () => ({
  api: { requestPasswordReset: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ForgotPage', () => {
  it('renders the request form', () => {
    renderWithProviders(<ForgotPage />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByText('Send reset link')).toBeInTheDocument();
  });

  it('shows a generic "check your email" message on submit, regardless of whether the account exists', async () => {
    api.requestPasswordReset.mockResolvedValue(undefined);
    renderWithProviders(<ForgotPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ada@example.com' } });
    fireEvent.click(screen.getByText('Send reset link'));
    expect(await screen.findByText(/If an account exists for ada@example.com/)).toBeInTheDocument();
    expect(api.requestPasswordReset).toHaveBeenCalledWith('ada@example.com');
  });

  it('still shows the same message even if the request rejects (never reveals which emails exist)', async () => {
    api.requestPasswordReset.mockRejectedValue(new Error('should not surface'));
    renderWithProviders(<ForgotPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nobody@example.com' } });
    fireEvent.click(screen.getByText('Send reset link'));
    expect(await screen.findByText(/If an account exists for nobody@example.com/)).toBeInTheDocument();
  });
});
