import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PasswordStrength, { scorePassword } from './PasswordStrength';

describe('scorePassword', () => {
  it('scores empty/short passwords as 0', () => {
    expect(scorePassword('')).toBe(0);
    expect(scorePassword('short')).toBe(0);
  });

  it('gives a higher score to a longer password', () => {
    expect(scorePassword('longenough')).toBeGreaterThan(scorePassword(''));
  });

  it('rewards length, case mixing, and digit+symbol mixing', () => {
    const weak = scorePassword('aaaaaaaa');
    const strong = scorePassword('Aa1!Aa1!Aa1!');
    expect(strong).toBeGreaterThan(weak);
  });

  it('never exceeds the max score of 4', () => {
    expect(scorePassword('Sup3r$ecure-Passphrase-99!')).toBeLessThanOrEqual(4);
  });
});

describe('PasswordStrength', () => {
  it('renders nothing when there is no value', () => {
    const { container } = render(<PasswordStrength value="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a strength label once there is a value', () => {
    render(<PasswordStrength value="password" />);
    expect(screen.getByText(/too short|weak|fair|good|strong/i)).toBeInTheDocument();
  });
});
