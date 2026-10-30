import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AuthCard from '../components/AuthCard';
import PasswordField from '../components/PasswordField';
import PasswordStrength from '../components/PasswordStrength';
import EmailField from '../components/EmailField';
import AuthAlert from '../components/AuthAlert';
import OAuthButtons from '../components/OAuthButtons';
import { signup, selectAuthStatus, selectAuthError, clearError } from '../authSlice';
import { sanitizeNext } from '@/lib/url';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const status = useSelector(selectAuthStatus);
  const error = useSelector(selectAuthError);
  const next = sanitizeNext(params.get('next'));
  const busy = status === 'loading';

  async function onSubmit(e) {
    e.preventDefault();
    dispatch(clearError());
    const res = await dispatch(signup({ name, email, password }));
    if (signup.fulfilled.match(res)) navigate(`/verify-email?next=${encodeURIComponent(next)}`);
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="No downloads, no hardware — you'll be wiring your first circuit in about a minute."
    >
      <OAuthButtons next={next} disabled={busy} />

      <div className="or">or sign up with email</div>

      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            className="input"
            required
            autoComplete="name"
            placeholder="Ada Lovelace"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <EmailField value={email} onChange={(e) => setEmail(e.target.value)} />

        <PasswordField
          id="password"
          label="Password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
        >
          <PasswordStrength value={password} />
        </PasswordField>

        <AuthAlert>{error}</AuthAlert>

        <button className="btn primary block auth-submit" type="submit" disabled={busy}>
          {busy && <span className="spin" aria-hidden="true" />}
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="auth-fine">
          We&apos;ll send a verification link to confirm your email.
        </p>
      </form>

      <p className="switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthCard>
  );
}
