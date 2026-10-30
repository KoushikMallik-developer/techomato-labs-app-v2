import { useState } from 'react';

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email input that confirms a well-formed address inline, and only
 * complains once you've left the field rather than while you're typing. */
export default function EmailField({ id = 'email', label = 'Email', value, onChange }) {
  const [touched, setTouched] = useState(false);
  const valid = LOOKS_LIKE_EMAIL.test(value.trim());
  const showError = touched && value.trim().length > 0 && !valid;

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <input
          id={id}
          className={`input${showError ? ' invalid' : ''}`}
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={value}
          onChange={onChange}
          onBlur={() => setTouched(true)}
        />
        {valid && (
          <span className="input-valid" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
        )}
      </div>
      {showError && <span className="field-error">Enter a valid email address.</span>}
    </div>
  );
}
