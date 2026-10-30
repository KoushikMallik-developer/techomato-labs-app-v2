import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PasswordField from './PasswordField';

/** `fireEvent.keyDown(el, { getModifierState })` doesn't work — KeyboardEventInit
 * has no such field, so the native event's real getModifierState wins. Build the
 * event by hand and override the method directly, then dispatch it. */
function keyWithCapsLock(type, capsOn) {
  const event = new KeyboardEvent(type, { key: 'a', bubbles: true, cancelable: true });
  event.getModifierState = (key) => (key === 'CapsLock' ? capsOn : false);
  return event;
}

describe('PasswordField', () => {
  it('masks the value by default and reveals it on toggle', () => {
    render(<PasswordField id="pw" label="Password" value="secret123" onChange={() => {}} />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByLabelText('Show password'));
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Hide password')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Hide password'));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('calls onChange as the user types', () => {
    const onChange = vi.fn();
    render(<PasswordField id="pw" label="Password" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('shows a Caps Lock warning while it is on, and hides it again once off', () => {
    render(<PasswordField id="pw" label="Password" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Password');

    fireEvent(input, keyWithCapsLock('keydown', true));
    expect(screen.getByText('Caps Lock is on.')).toBeInTheDocument();

    fireEvent(input, keyWithCapsLock('keyup', false));
    expect(screen.queryByText('Caps Lock is on.')).not.toBeInTheDocument();
  });

  it('clears the Caps Lock warning on blur', () => {
    render(<PasswordField id="pw" label="Password" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Password');
    fireEvent(input, keyWithCapsLock('keydown', true));
    expect(screen.getByText('Caps Lock is on.')).toBeInTheDocument();
    fireEvent.blur(input);
    expect(screen.queryByText('Caps Lock is on.')).not.toBeInTheDocument();
  });

  it('renders an action next to the label and extra children below the field', () => {
    render(
      <PasswordField id="pw" label="Password" value="" onChange={() => {}} action={<span>Forgot password?</span>}>
        <span>meter</span>
      </PasswordField>,
    );
    expect(screen.getByText('Forgot password?')).toBeInTheDocument();
    expect(screen.getByText('meter')).toBeInTheDocument();
  });

  it('defaults autoComplete to current-password', () => {
    render(<PasswordField id="pw" label="Password" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });
});
