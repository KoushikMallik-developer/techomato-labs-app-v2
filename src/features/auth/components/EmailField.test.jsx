import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EmailField from './EmailField';

function Controlled(props) {
  const [value, setValue] = useState(props.initial || '');
  return <EmailField {...props} value={value} onChange={(e) => setValue(e.target.value)} />;
}

describe('EmailField', () => {
  it('shows no error and no checkmark before anything is typed', () => {
    render(<Controlled />);
    expect(screen.queryByText(/valid email/)).not.toBeInTheDocument();
    expect(document.querySelector('.input-valid')).not.toBeInTheDocument();
  });

  it('does not show an error while still typing an invalid address (not yet blurred)', () => {
    render(<Controlled />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-an-email' } });
    expect(screen.queryByText(/valid email/)).not.toBeInTheDocument();
  });

  it('shows an inline error once blurred with an invalid address', () => {
    render(<Controlled />);
    const input = screen.getByLabelText('Email');
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.blur(input);
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(input.className).toContain('invalid');
  });

  it('does not show an error for an empty field even after blur', () => {
    render(<Controlled />);
    const input = screen.getByLabelText('Email');
    fireEvent.blur(input);
    expect(screen.queryByText(/valid email/)).not.toBeInTheDocument();
  });

  it('shows the checkmark and no error for a well-formed address', () => {
    render(<Controlled />);
    const input = screen.getByLabelText('Email');
    fireEvent.change(input, { target: { value: 'ada@example.com' } });
    fireEvent.blur(input);
    expect(screen.queryByText(/valid email/)).not.toBeInTheDocument();
    expect(document.querySelector('.input-valid')).toBeInTheDocument();
  });

  it('accepts a custom id/label', () => {
    render(<Controlled id="signup-email" label="Work email" />);
    expect(screen.getByLabelText('Work email')).toHaveAttribute('id', 'signup-email');
  });
});
