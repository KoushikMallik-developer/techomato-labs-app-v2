/** Inline error banner for auth forms — replaces a bare red line of text. */
export default function AuthAlert({ children }) {
  if (!children) return null;
  return (
    <div className="auth-alert" role="alert">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.2v.3" />
      </svg>
      <span>{children}</span>
    </div>
  );
}
