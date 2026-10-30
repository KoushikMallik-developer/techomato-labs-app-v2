const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

/** Advisory only — the account rules themselves are enforced by the backend
 * (8+ characters, not all-numeric, not a common password). */
export function scorePassword(pw) {
  if (!pw || pw.length < 8) return 0;
  let score = 1;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^\w\s]/.test(pw)) score++;
  return Math.min(4, score);
}

export default function PasswordStrength({ value }) {
  if (!value) return null;
  const score = scorePassword(value);
  return (
    <div className="pw-meter" aria-live="polite">
      <div className="pw-bars">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={i <= score ? `on s${score}` : ''} />
        ))}
      </div>
      <span className="pw-label">{LABELS[score]}</span>
    </div>
  );
}
