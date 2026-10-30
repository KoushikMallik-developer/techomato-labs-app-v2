import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireGuest from './RequireGuest';

function fakeStore(state) {
  return { getState: () => state, subscribe: () => () => {}, dispatch: () => {} };
}

function renderLogin(user) {
  return render(
    <Provider store={fakeStore({ auth: { user } })}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route
            path="/login"
            element={
              <RequireGuest>
                <div>Login form</div>
              </RequireGuest>
            }
          />
          <Route path="/projects" element={<div>Your projects</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('RequireGuest', () => {
  it('redirects an already signed-in visitor away to /projects', () => {
    renderLogin({ id: 'u-1', email: 'a@b.com' });
    expect(screen.getByText('Your projects')).toBeInTheDocument();
    expect(screen.queryByText('Login form')).not.toBeInTheDocument();
  });

  it('renders the guest-only content (e.g. the login form) for a signed-out visitor', () => {
    renderLogin(null);
    expect(screen.getByText('Login form')).toBeInTheDocument();
  });
});
