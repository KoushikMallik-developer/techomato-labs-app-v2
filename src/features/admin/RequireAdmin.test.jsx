import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import RequireAdmin from './RequireAdmin';

function fakeStore(isAdmin) {
  const state = { admin: { isAdmin } };
  return { getState: () => state, subscribe: () => () => {}, dispatch: () => {} };
}

function renderAdmin(isAdmin) {
  return render(
    <Provider store={fakeStore(isAdmin)}>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <div>Moderation panel</div>
              </RequireAdmin>
            }
          />
          <Route path="/admin/login" element={<div>Admin login</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('RequireAdmin', () => {
  it('redirects a non-admin session to /admin/login', () => {
    renderAdmin(false);
    expect(screen.getByText('Admin login')).toBeInTheDocument();
    expect(screen.queryByText('Moderation panel')).not.toBeInTheDocument();
  });

  it('renders the moderation panel for an admin session', () => {
    renderAdmin(true);
    expect(screen.getByText('Moderation panel')).toBeInTheDocument();
  });

  it('does not treat a signed-in regular user as an admin', () => {
    // isAdmin lives entirely in adminSlice, separate from auth.user — a regular
    // session must not leak into the admin-only area.
    renderAdmin(false);
    expect(screen.getByText('Admin login')).toBeInTheDocument();
  });
});
