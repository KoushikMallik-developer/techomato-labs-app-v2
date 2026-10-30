import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AuthCard from '../components/AuthCard';
import PasswordField from '../components/PasswordField';
import EmailField from '../components/EmailField';
import AuthAlert from '../components/AuthAlert';
import OAuthButtons from '../components/OAuthButtons';
import { login, selectAuthStatus, selectAuthError, clearError } from '../authSlice';
import { sanitizeNext } from '@/lib/url';

export default function LoginPage() {
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
    const res = await dispatch(login({ email, password }));
    if (login.fulfilled.match(res)) {
      if (!res.payload.verified) navigate(`/verify-email?next=${encodeURIComponent(next)}`);
      else navigate(next);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Pick up right where you left off — every circuit and sketch is where you saved it."
    >
      <OAuthButtons next={next} disabled={busy} />

      <div className="or">or continue with email</div>

      <form onSubmit={onSubmit}>
        <EmailField value={email} onChange={(e) => setEmail(e.target.value)} />

        <PasswordField
          id="password"
          label="Password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          action={
            <Link className="field-hint-link" to="/forgot">
              Forgot password?
            </Link>
          }
        />

        <AuthAlert>{error}</AuthAlert>

        <button className="btn primary block auth-submit" type="submit" disabled={busy}>
          {busy && <span className="spin" aria-hidden="true" />}
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="switch">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </AuthCard>
  );
}
