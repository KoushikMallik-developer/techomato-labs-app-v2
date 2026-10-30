import { useState } from 'react';

function EyeIcon({ off }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {off ? (
        <>
          <path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c5 0 9 6 9 6a15.5 15.5 0 0 1-2.9 3.3M6.5 7.9A15.7 15.7 0 0 0 3 12s4 6 9 6a9.3 9.3 0 0 0 3.6-.72" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
        </>
      ) : (
        <>
          <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export default function PasswordField({ id, label, value, onChange, autoComplete = 'current-password', action, children }) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);

  // getModifierState is only meaningful on a real key event, so this reads
  // it from the keyboard itself rather than trying to track state.
  function readCapsLock(e) {
    if (typeof e.getModifierState === 'function') setCaps(e.getModifierState('CapsLock'));
  }

  return (
    <div className="field">
      <div className="field-row">
        <label htmlFor={id}>{label}</label>
        {action}
      </div>
      <div className="input-wrap">
        <input
          id={id}
          className="input"
          type={show ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          onKeyUp={readCapsLock}
          onKeyDown={readCapsLock}
          onBlur={() => setCaps(false)}
        />
        <button
          type="button"
          className="input-toggle"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          <EyeIcon off={show} />
        </button>
      </div>
      {caps && <span className="field-warn">Caps Lock is on.</span>}
      {children}
    </div>
  );
}
