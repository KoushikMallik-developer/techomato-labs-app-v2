import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, signedInUser, authState } from '@/test-utils';
import NotFoundPage from './NotFoundPage';

describe('NotFoundPage', () => {
  it('shows the not-found message and a link back home', () => {
    renderWithProviders(<NotFoundPage />);
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByText('Back home')).toHaveAttribute('href', '/');
  });

  it('shows the marketing nav (signed out)', () => {
    renderWithProviders(<NotFoundPage />);
    expect(screen.getByText('Community Circuits')).toBeInTheDocument();
    expect(screen.queryByText('Projects')).not.toBeInTheDocument();
  });

  it('shows Projects in the nav for a signed-in visitor', () => {
    renderWithProviders(<NotFoundPage />, { preloadedState: { auth: authState({ user: signedInUser() }) } });
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });
});
