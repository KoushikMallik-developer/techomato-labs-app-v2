import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AuthAlert from './AuthAlert';

describe('AuthAlert', () => {
  it('renders nothing when there is no message', () => {
    const { container } = render(<AuthAlert>{null}</AuthAlert>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the message inside an alert role', () => {
    render(<AuthAlert>Email or password is incorrect.</AuthAlert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });
});
