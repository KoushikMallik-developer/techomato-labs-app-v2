import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders } from '@/test-utils';
import { api } from '@/lib/api';
import AdminLoginPage from './AdminLoginPage';

vi.mock('@/lib/api', () => ({
  api: { adminLogin: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderAt(route = '/admin/login') {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<div>Admin panel</div>} />
    </Routes>,
    { route },
  );
}

describe('AdminLoginPage', () => {
  it('renders the form', () => {
    renderAt();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('navigates to /admin on success', async () => {
    api.adminLogin.mockResolvedValue({ email: 'admin@techomato.com' });
    renderAt();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@techomato.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'CorrectPassword1!' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('Admin panel')).toBeInTheDocument();
  });

  it('shows an error and stays put on invalid credentials', async () => {
    api.adminLogin.mockRejectedValue(new Error('Invalid admin email or password.'));
    renderAt();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@techomato.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('Invalid admin email or password.')).toBeInTheDocument();
    expect(screen.queryByText('Admin panel')).not.toBeInTheDocument();
  });

  it('disables the button and shows a loading label while submitting', async () => {
    let resolveLogin;
    api.adminLogin.mockReturnValue(new Promise((res) => { resolveLogin = res; }));
    renderAt();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@techomato.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(await screen.findByText('Logging in…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
    resolveLogin({ email: 'admin@techomato.com' });
    await waitFor(() => expect(screen.getByText('Admin panel')).toBeInTheDocument());
  });
});
