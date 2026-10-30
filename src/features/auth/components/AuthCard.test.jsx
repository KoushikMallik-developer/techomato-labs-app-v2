import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthCard from './AuthCard';

describe('AuthCard', () => {
  it('renders the title, subtitle, and children', () => {
    render(
      <MemoryRouter>
        <AuthCard title="Welcome back" subtitle="Pick up where you left off.">
          <button>Log in</button>
        </AuthCard>
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByText('Pick up where you left off.')).toBeInTheDocument();
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });

  it('links the brand back to the landing page', () => {
    render(
      <MemoryRouter>
        <AuthCard title="t" subtitle="s">
          <div />
        </AuthCard>
      </MemoryRouter>,
    );
    const brandLinks = screen.getAllByText('Techomato Labs');
    brandLinks.forEach((el) => expect(el.closest('a')).toHaveAttribute('href', '/'));
  });

  it('shows the live circuit demo caption', () => {
    render(
      <MemoryRouter>
        <AuthCard title="t" subtitle="s">
          <div />
        </AuthCard>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Running live: an ultrasonic parking sensor/)).toBeInTheDocument();
  });
});
