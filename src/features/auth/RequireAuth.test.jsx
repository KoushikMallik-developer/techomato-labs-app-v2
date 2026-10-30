import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import RequireAuth from './RequireAuth';

function fakeStore(state) {
  return { getState: () => state, subscribe: () => () => {}, dispatch: () => {} };
}

function LoginProbe() {
  const location = useLocation();
  return <div>Login Page ({location.pathname + location.search})</div>;
}

function renderAt(path, user) {
  return render(
    <Provider store={fakeStore({ auth: { user } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/projects"
            element={
              <RequireAuth>
                <div>Secret projects</div>
              </RequireAuth>
            }
          />
          <Route path="/login" element={<LoginProbe />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
}

describe('RequireAuth', () => {
  it('redirects signed-out visitors to /login with the attempted path as next', () => {
    renderAt('/projects?tab=recent', null);
    expect(screen.getByText(/Login Page/)).toBeInTheDocument();
    expect(screen.getByText(/%2Fprojects%3Ftab%3Drecent/)).toBeInTheDocument();
  });

  it('renders the protected content for a signed-in user', () => {
    renderAt('/projects', { id: 'u-1', email: 'a@b.com' });
    expect(screen.getByText('Secret projects')).toBeInTheDocument();
  });
});
